import ts from 'typescript'

const httpMethodByCallName: Record<string, string> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
}

const dottedIdentifierPathRegex =
  /[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+/g

const getCallPropertyName = (expression: ts.CallExpression) => {
  if (!ts.isPropertyAccessExpression(expression.expression)) {
    return undefined
  }
  return expression.expression.name.text
}

const getStringLiteralArgument = (
  expression: ts.CallExpression,
  argumentIndex: number
) => {
  const argument = expression.arguments.at(argumentIndex)
  return argument && ts.isStringLiteral(argument) ? argument.text : undefined
}

const collectCallChain = (expression: ts.Expression) => {
  const calls: ts.CallExpression[] = []
  let current: ts.Expression | undefined = expression

  while (current) {
    if (ts.isCallExpression(current)) {
      calls.unshift(current)
      current = ts.isPropertyAccessExpression(current.expression)
        ? current.expression.expression
        : undefined
      continue
    }

    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression
      continue
    }

    break
  }

  return calls
}

const extractMethodPathVersionFromCallChain = (
  calls: ts.CallExpression[]
): { method: string; path: string; version: string } | undefined => {
  let method: string | undefined
  let path: string | undefined
  // routes without `.version()` are registered with an empty version
  let version = ''

  for (const call of calls) {
    const callName = getCallPropertyName(call)
    if (!callName) {
      continue
    }

    if (callName === 'version') {
      version = getStringLiteralArgument(call, 0) ?? version
      continue
    }

    const httpMethod = httpMethodByCallName[callName]
    if (httpMethod) {
      method = httpMethod
      path = getStringLiteralArgument(call, 0) ?? path
    }
  }

  if (!method || !path) {
    return undefined
  }

  return { method, path, version }
}

/**
 * Extracts a versioned namespace path from a type argument text such as
 * `APIResponse<V2026_06_09.Customer.Checkout.Checkout>`.
 */
export const extractNamingContextFromTypeText = (
  typeText: string
): string | undefined => {
  const matches = typeText.match(dottedIdentifierPathRegex)
  if (!matches || matches.length === 0) {
    return undefined
  }

  const bestMatch = [...matches].sort((left, right) => {
    const segmentDifference = right.split('.').length - left.split('.').length
    return segmentDifference !== 0
      ? segmentDifference
      : right.length - left.length
  })[0]

  const segments = bestMatch.split('.')
  if (segments.length < 2) {
    return undefined
  }

  return segments.slice(0, -1).join('.')
}

export const buildRouteNamingContextKey = (
  method: string,
  path: string,
  version: string
) => `${method}:${path}:${version}`

export type RouteNamingContext = {
  input?: string
  response?: string
}

/**
 * Extracts the naming context of explicitly written types inside a validator
 * expression, e.g. `z.custom<V2026_06_09.Customer.Checkout.Body>()`. Only type
 * nodes are considered so that value accessors like `z.object` are ignored.
 */
const extractNamingContextFromValidator = (
  call: ts.CallExpression,
  sourceFile: ts.SourceFile
) => {
  let namingContext: string | undefined

  const visit = (node: ts.Node) => {
    if (namingContext) {
      return
    }

    if (ts.isTypeNode(node)) {
      namingContext = extractNamingContextFromTypeText(node.getText(sourceFile))
      return
    }

    ts.forEachChild(node, visit)
  }

  call.typeArguments?.forEach(visit)
  call.arguments.forEach(visit)

  return namingContext
}

const getDeclarationsToFollow = (
  symbol: ts.Symbol | undefined,
  typeChecker: ts.TypeChecker
) => {
  if (!symbol) {
    return []
  }

  const resolvedSymbol =
    symbol.flags & ts.SymbolFlags.Alias
      ? typeChecker.getAliasedSymbol(symbol)
      : symbol

  return (resolvedSymbol.declarations ?? []).filter(
    (declaration) => !declaration.getSourceFile().isDeclarationFile
  )
}

const containsNode = (container: ts.Node, node: ts.Node) =>
  container.getSourceFile() === node.getSourceFile() &&
  container.pos <= node.pos &&
  node.end <= container.end

/**
 * Whether the value of `member` depends on a parameter of a function that
 * encloses it, either directly or through local variables of that function,
 * e.g. `customer` in `function wrap(customer) { return { customer } }`.
 */
const dependsOnEnclosingParameter = (
  member:
    | ts.PropertyAssignment
    | ts.ShorthandPropertyAssignment
    | ts.PropertyDeclaration,
  typeChecker: ts.TypeChecker
) => {
  const visitedDeclarations = new Set<ts.Node>()

  const isEnclosingParameterOrLocal = (declaration: ts.Declaration) => {
    const owner = ts.isParameter(declaration)
      ? declaration.parent
      : ts.findAncestor(declaration.parent, ts.isFunctionLike)
    return !!owner && containsNode(owner, member)
  }

  const dependsOnDeclarations = (symbol: ts.Symbol | undefined): boolean =>
    (symbol?.declarations ?? []).some((declaration) => {
      if (
        visitedDeclarations.has(declaration) ||
        !isEnclosingParameterOrLocal(declaration)
      ) {
        return false
      }
      visitedDeclarations.add(declaration)

      if (ts.isParameter(declaration)) {
        return true
      }
      // other locals, e.g. inner functions, are conservatively treated as
      // argument-dependent
      return ts.isVariableDeclaration(declaration) && declaration.initializer
        ? dependsOnExpression(declaration.initializer)
        : true
    })

  const dependsOnExpression = (node: ts.Node): boolean => {
    if (ts.isTypeNode(node)) {
      return false
    }
    if (ts.isIdentifier(node)) {
      return dependsOnDeclarations(typeChecker.getSymbolAtLocation(node))
    }
    return !!ts.forEachChild(
      node,
      (child) => dependsOnExpression(child) || undefined
    )
  }

  if (ts.isShorthandPropertyAssignment(member)) {
    return dependsOnDeclarations(
      typeChecker.getShorthandAssignmentValueSymbol(member)
    )
  }
  return !!member.initializer && dependsOnExpression(member.initializer)
}

/**
 * Object and class members whose value is fully described by their own
 * declaration, so that `container.member` can be followed without visiting
 * the sibling members of `container`. Members whose value depends on the
 * arguments of the call that produced `container`, e.g. `wrap(bag).customer`,
 * are excluded.
 */
const isMemberValueDeclaration = (
  declaration: ts.Declaration,
  typeChecker: ts.TypeChecker
): declaration is
  | ts.PropertyAssignment
  | ts.ShorthandPropertyAssignment
  | ts.PropertyDeclaration =>
  (ts.isPropertyAssignment(declaration) ||
    ts.isShorthandPropertyAssignment(declaration) ||
    (ts.isPropertyDeclaration(declaration) && !!declaration.initializer)) &&
  !dependsOnEnclosingParameter(declaration, typeChecker)

/**
 * Walks the route builder call chains reachable from the bag of routes
 * expression (`entryNode`) to recover public type namespace context that
 * TypeScript erases for transparent re-exports. Identifiers are followed to
 * their declarations, so routes defined in other variables or modules are
 * included, while unrelated bags in the same program are not.
 */
export const extractRouteNamingContexts = (
  entryNode: ts.Node,
  typeChecker: ts.TypeChecker
) => {
  const namingContexts = new Map<string, RouteNamingContext>()
  const visitedDeclarations = new Set<ts.Node>()

  const setNamingContext = (
    call: ts.CallExpression,
    kind: keyof RouteNamingContext,
    namingContext: string | undefined
  ) => {
    const routeMeta = extractMethodPathVersionFromCallChain(
      collectCallChain(call)
    )
    if (!namingContext || !routeMeta) {
      return
    }

    const key = buildRouteNamingContextKey(
      routeMeta.method,
      routeMeta.path,
      routeMeta.version
    )
    const existing = namingContexts.get(key) ?? {}
    // the first route found while walking from the entry wins
    if (existing[kind] === undefined) {
      namingContexts.set(key, { ...existing, [kind]: namingContext })
    }
  }

  const followDeclarations = (declarations: ts.Declaration[]) => {
    for (const declaration of declarations) {
      if (visitedDeclarations.has(declaration)) {
        continue
      }
      visitedDeclarations.add(declaration)

      if (
        (ts.isVariableDeclaration(declaration) ||
          ts.isPropertyAssignment(declaration) ||
          ts.isPropertyDeclaration(declaration)) &&
        declaration.initializer
      ) {
        visit(declaration.initializer)
      } else if (ts.isShorthandPropertyAssignment(declaration)) {
        followDeclarations(
          getDeclarationsToFollow(
            typeChecker.getShorthandAssignmentValueSymbol(declaration),
            typeChecker
          )
        )
      } else if (
        ts.isFunctionDeclaration(declaration) ||
        ts.isMethodDeclaration(declaration) ||
        ts.isExportAssignment(declaration)
      ) {
        visit(declaration)
      }
    }
  }

  const visit = (node: ts.Node) => {
    if (ts.isTypeNode(node)) {
      return
    }

    if (ts.isPropertyAccessExpression(node)) {
      const memberDeclarations = getDeclarationsToFollow(
        typeChecker.getSymbolAtLocation(node.name),
        typeChecker
      )
      // `bags.customer` only depends on the selected member, so the receiver
      // is not visited to avoid collecting the routes of sibling members
      if (
        memberDeclarations.length > 0 &&
        memberDeclarations.every((declaration) =>
          isMemberValueDeclaration(declaration, typeChecker)
        )
      ) {
        followDeclarations(memberDeclarations)
        return
      }
    }

    if (ts.isCallExpression(node)) {
      const callName = getCallPropertyName(node)
      const sourceFile = node.getSourceFile()

      if (callName === 'response' && node.typeArguments?.[0]) {
        setNamingContext(
          node,
          'response',
          extractNamingContextFromTypeText(
            node.typeArguments[0].getText(sourceFile)
          )
        )
      }

      if (callName === 'validate') {
        setNamingContext(
          node,
          'input',
          extractNamingContextFromValidator(node, sourceFile)
        )
      }
    }

    if (ts.isIdentifier(node)) {
      followDeclarations(
        getDeclarationsToFollow(
          typeChecker.getSymbolAtLocation(node),
          typeChecker
        )
      )
    }

    ts.forEachChild(node, visit)
  }

  visit(entryNode)

  return namingContexts
}
