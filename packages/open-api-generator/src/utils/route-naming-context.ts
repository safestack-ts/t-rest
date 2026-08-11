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
  let version: string | undefined

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

  if (!method || !path || !version) {
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
    const segmentDifference =
      right.split('.').length - left.split('.').length
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

/**
 * Walks route builder call chains in the program AST to recover public type
 * namespace context that TypeScript erases for transparent re-exports.
 */
export const extractRouteNamingContextsFromProgram = (program: ts.Program) => {
  const namingContexts = new Map<string, string>()

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) {
      continue
    }

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        getCallPropertyName(node) === 'response' &&
        node.typeArguments?.[0]
      ) {
        const namingContext = extractNamingContextFromTypeText(
          node.typeArguments[0].getText(sourceFile)
        )
        const routeMeta = extractMethodPathVersionFromCallChain(
          collectCallChain(node)
        )

        if (namingContext && routeMeta) {
          namingContexts.set(
            buildRouteNamingContextKey(
              routeMeta.method,
              routeMeta.path,
              routeMeta.version
            ),
            namingContext
          )
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  return namingContexts
}
