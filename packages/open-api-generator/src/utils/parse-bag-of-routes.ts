import { HashMap, normalizePathPattern } from '@t-rest/core'
import ts from 'typescript'
import { ObjectType, TypeDefinition } from '../schema/type-schema.js'
import debug from 'debug'
import { hashOpenAPISchema } from './openapi-schema-normalize.js'
import { groupBy, isEqual, uniqWith } from 'lodash'
import path from 'path'
import {
  CanonicalTypeOwnershipOptions,
  OpenAPIGeneratorOptions,
  resolveOpenAPIGeneratorOptions,
} from '../types/open-api-generator-options.js'
import {
  buildPublicTypeReExportIndex,
  matchPublicNamespace,
  resolveUltimateTypeTargetId,
  selectCanonicalPublicReExport,
  selectReExportForContext,
  type PublicTypeReExport,
} from './public-type-reexports.js'
import {
  buildRouteNamingContextKey,
  extractRouteNamingContexts,
  type RouteNamingContext,
} from './route-naming-context.js'

const parserLog = debug('t-rest:open-api-generator:parser')
const typeDiscoveryLog = debug('t-rest:open-api-generator:type-discovery')

export type RouteTypeInfo = {
  input: TypeDefinition | undefined
  output: TypeDefinition | undefined
  routeMeta: {
    originalPath: string
  }
}

export const parseBagOfRoutes = (
  modulePath: string,
  tsConfigPath: string,
  options?: OpenAPIGeneratorOptions
) => {
  parserLog('Parsing routes from module: %s', modulePath)
  const resolvedOptions = resolveOpenAPIGeneratorOptions(options)

  const { program, sourceFile, typeChecker } = initializeProgram(
    modulePath,
    tsConfigPath
  )
  const rootNode = findDefaultExport(sourceFile)
  const routeTypes = extractRouteTypes(rootNode, typeChecker)
  const exportedModuleNamespacePaths = buildExportedModuleNamespacePathIndex(
    program,
    typeChecker
  )
  const publicTypeReExportsByTarget = buildPublicTypeReExportIndex(
    program,
    typeChecker,
    exportedModuleNamespacePaths
  )
  const routeNamingContexts = extractRouteNamingContexts(rootNode, typeChecker)
  // canonical owner namespace per type target and audience, shared across routes
  const canonicalOwnerByTarget = new Map<string, string>()

  const results = new HashMap<[string, string, string], RouteTypeInfo>((key) =>
    key.join('-')
  )

  const createTraverseMeta = (
    rootType: ts.Type | undefined,
    routeNamingContext?: string
  ): TraverseMeta => {
    const namingContext =
      routeNamingContext ??
      (rootType
        ? deriveNamingContext(
            rootType,
            typeChecker,
            rootNode,
            resolvedOptions,
            exportedModuleNamespacePaths
          )
        : undefined)

    return {
      visitedTypes: new Set(),
      options: resolvedOptions,
      exportedModuleNamespacePaths,
      publicTypeReExportsByTarget,
      canonicalOwnerByTarget,
      expandingTypes: new Map(),
      recursiveUnionTypes: new Set(),
      namingContext,
    }
  }

  const resolveRouteNamingContext = (
    route: { method: string; path: string; version: string },
    kind: keyof RouteNamingContext,
    namingContext: RouteNamingContext
  ) =>
    namingContext[kind] ??
    resolvedOptions.deriveRouteNamingContext?.({
      ...route,
      kind,
      namingContext,
    })

  for (const routeType of routeTypes) {
    const { method, path, version } = extractRouteMetadata(
      routeType,
      typeChecker,
      rootNode
    )
    const routeNamingContext =
      routeNamingContexts.get(
        buildRouteNamingContextKey(method, path, version)
      ) ?? {}

    parserLog('Processing route: %s %s (v%s)', method, path, version)

    parserLog(
      'Parsing validator type of route: %s %s (v%s)',
      method,
      path,
      version
    )
    const validatorType = extractValidatorType(routeType, typeChecker, rootNode)

    parserLog(
      'Parsing response type of route: %s %s (v%s)',
      method,
      path,
      version
    )
    const responseType = extractResponseType(routeType, typeChecker, rootNode)

    const inputOutputIntermediate = {
      input: validatorType
        ? transformTypeToIntermediate(
            validatorType,
            typeChecker,
            rootNode,
            createTraverseMeta(
              validatorType,
              resolveRouteNamingContext(
                { method, path, version },
                'input',
                routeNamingContext
              )
            )
          )
        : undefined,
      output: responseType
        ? transformTypeToIntermediate(
            responseType,
            typeChecker,
            rootNode,
            createTraverseMeta(
              responseType,
              resolveRouteNamingContext(
                { method, path, version },
                'response',
                routeNamingContext
              )
            )
          )
        : undefined,
      routeMeta: {
        originalPath: path,
      },
    }

    results.set(
      [method, normalizePathPattern(path), version],
      inputOutputIntermediate
    )
  }

  parserLog('Finished parsing %d routes', results.size)

  return results
}

type TraverseMeta = {
  visitedTypes?: Set<string>
  options: ReturnType<typeof resolveOpenAPIGeneratorOptions>
  exportedModuleNamespacePaths: Map<string, string[]>
  publicTypeReExportsByTarget: Map<string, PublicTypeReExport[]>
  canonicalOwnerByTarget: Map<string, string>
  // how often each type is currently expanded, to detect recursion of types without a tracked name
  expandingTypes: Map<ts.Type, number>
  // named unions that are referenced by their own members
  recursiveUnionTypes: Set<ts.Type>
  namingContext?: string
}

type TypeIdentityMeta = {
  name?: string
  namespaceName?: string
  qualifiedName?: string
  schemaName?: string
}

// binary data, e.g. `Uint8Array` or `DataView`, is serialized like a `Buffer`
const isBinaryTypeName = (value: string) =>
  value === 'DataView' ||
  /^(Big)?(Int|Uint|Float)(8|16|32|64)(Clamped)?Array$/.test(value)

const isBuiltInTypeName = (value?: string) =>
  Boolean(
    value &&
      (value === 'Date' ||
        value === 'Array' ||
        value.endsWith('Buffer') ||
        isBinaryTypeName(value) ||
        value === 'BigInt' ||
        value === 'Symbol' ||
        value === 'Map' ||
        value === 'Set' ||
        value === 'RegExp' ||
        value === 'Stream')
  )

const isTrackableNamedType = (value?: string): value is string =>
  Boolean(
    value &&
      value !== 'string' &&
      value !== 'number' &&
      value !== 'boolean' &&
      value !== 'null' &&
      value !== 'undefined' &&
      value !== 'unknown' &&
      value !== 'any' &&
      value !== '__type' &&
      value !== '__object' &&
      !isBuiltInTypeName(value) &&
      !value.match(/^\[.*\]$/) &&
      !value.match(/^\{.*\}$/) &&
      value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
  )

const isIgnoredSyntheticPropertyName = (value: string) =>
  value.match(/^__@\$brand@\d+$/) !== null

const toOpenAPIComponentName = (value: string) =>
  value
    .replace(/\./g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

const extractNamespaceName = (declaration: ts.Declaration | undefined) => {
  if (!declaration) {
    return undefined
  }

  const namespaceParts: string[] = []
  let parent: ts.Node | undefined = declaration.parent

  while (parent) {
    if (ts.isModuleDeclaration(parent)) {
      namespaceParts.unshift(parent.name.getText())
    }
    parent = parent.parent
  }

  return namespaceParts.length > 0 ? namespaceParts.join('.') : undefined
}

const cleanDottedIdentifierPathRegex =
  /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)+$/

type ModuleNamespaceExportEdge = {
  fromFileName: string
  targetFileName: string
  exportedName: string
}

const getSourceFileFromSymbol = (symbol: ts.Symbol | undefined) =>
  symbol?.declarations?.find((declaration): declaration is ts.SourceFile =>
    ts.isSourceFile(declaration)
  )

const getAliasedSourceFile = (
  symbol: ts.Symbol | undefined,
  typeChecker: ts.TypeChecker
) => {
  if (!symbol) {
    return undefined
  }

  const aliasedSymbol =
    symbol.flags & ts.SymbolFlags.Alias
      ? typeChecker.getAliasedSymbol(symbol)
      : symbol

  return getSourceFileFromSymbol(aliasedSymbol)
}

const addNamespaceExportEdge = (
  edges: ModuleNamespaceExportEdge[],
  fromFileName: string,
  exportedName: string,
  targetSourceFile: ts.SourceFile | undefined
) => {
  if (!targetSourceFile) {
    return
  }

  edges.push({
    fromFileName,
    targetFileName: targetSourceFile.fileName,
    exportedName,
  })
}

const collectModuleNamespaceExportEdges = (
  program: ts.Program,
  typeChecker: ts.TypeChecker
) => {
  const edges: ModuleNamespaceExportEdge[] = []

  program.getSourceFiles().forEach((sourceFile) => {
    if (sourceFile.isDeclarationFile) {
      return
    }

    sourceFile.statements.forEach((statement) => {
      if (!ts.isExportDeclaration(statement) || !statement.exportClause) {
        return
      }

      if (ts.isNamespaceExport(statement.exportClause)) {
        const moduleSymbol =
          statement.moduleSpecifier &&
          typeChecker.getSymbolAtLocation(statement.moduleSpecifier)
        addNamespaceExportEdge(
          edges,
          sourceFile.fileName,
          statement.exportClause.name.text,
          getSourceFileFromSymbol(moduleSymbol)
        )
        return
      }

      statement.exportClause.elements.forEach((exportSpecifier) => {
        const exportSymbol = typeChecker.getSymbolAtLocation(
          exportSpecifier.name
        )
        addNamespaceExportEdge(
          edges,
          sourceFile.fileName,
          exportSpecifier.name.text,
          getAliasedSourceFile(exportSymbol, typeChecker)
        )
      })
    })
  })

  return edges
}

const addNamespacePath = (
  namespacePathsByFileName: Map<string, Set<string>>,
  fileName: string,
  namespacePath: string,
  maxPathSegments: number
) => {
  if (namespacePath.split('.').length > maxPathSegments) {
    return false
  }

  if (!cleanDottedIdentifierPathRegex.test(`${namespacePath}.Leaf`)) {
    return false
  }

  const namespacePaths = namespacePathsByFileName.get(fileName) ?? new Set()
  const previousSize = namespacePaths.size
  namespacePaths.add(namespacePath)
  namespacePathsByFileName.set(fileName, namespacePaths)

  return namespacePaths.size > previousSize
}

const buildExportedModuleNamespacePathIndex = (
  program: ts.Program,
  typeChecker: ts.TypeChecker
) => {
  const edges = collectModuleNamespaceExportEdges(program, typeChecker)
  const namespacePathsByFileName = new Map<string, Set<string>>()

  edges.forEach((edge) => {
    addNamespacePath(
      namespacePathsByFileName,
      edge.targetFileName,
      edge.exportedName,
      edges.length + 1
    )
  })

  let changed = true
  while (changed) {
    changed = false

    edges.forEach((edge) => {
      const parentNamespacePaths = namespacePathsByFileName.get(
        edge.fromFileName
      )
      if (!parentNamespacePaths) {
        return
      }

      parentNamespacePaths.forEach((parentNamespacePath) => {
        changed =
          addNamespacePath(
            namespacePathsByFileName,
            edge.targetFileName,
            `${parentNamespacePath}.${edge.exportedName}`,
            edges.length + 1
          ) || changed
      })
    })
  }

  return new Map(
    [...namespacePathsByFileName.entries()].map(
      ([fileName, namespacePaths]) => [
        fileName,
        [...namespacePaths].sort((a, b) => {
          const segmentDifference = b.split('.').length - a.split('.').length
          return segmentDifference !== 0
            ? segmentDifference
            : a.localeCompare(b)
        }),
      ]
    )
  )
}

const isExportedFromSourceFile = (
  sourceFile: ts.SourceFile,
  typeName: string,
  typeChecker: ts.TypeChecker
) => {
  const sourceFileSymbol = typeChecker.getSymbolAtLocation(sourceFile)
  return (
    sourceFileSymbol !== undefined &&
    typeChecker
      .getExportsOfModule(sourceFileSymbol)
      .some((exportSymbol) => exportSymbol.name === typeName)
  )
}

const resolveExportedModuleNamespaceTypeName = (
  declaration: ts.Declaration | undefined,
  typeName: string | undefined,
  typeChecker: ts.TypeChecker,
  exportedModuleNamespacePaths: Map<string, string[]>
) => {
  if (!declaration || !typeName) {
    return undefined
  }

  const sourceFile = declaration.getSourceFile()
  if (!isExportedFromSourceFile(sourceFile, typeName, typeChecker)) {
    return undefined
  }

  const namespacePath = exportedModuleNamespacePaths.get(
    sourceFile.fileName
  )?.[0]
  return namespacePath ? `${namespacePath}.${typeName}` : undefined
}

const resolveQualifiedTypeName = (
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
  typeName: string | undefined
) => {
  if (!typeName) {
    return undefined
  }

  const qualifiedName = typeChecker.typeToString(
    type,
    rootNode,
    ts.TypeFormatFlags.UseFullyQualifiedType
  )

  if (!cleanDottedIdentifierPathRegex.test(qualifiedName)) {
    return undefined
  }

  const qualifiedNameLeaf = qualifiedName.split('.').at(-1)
  return qualifiedNameLeaf === typeName ? qualifiedName : undefined
}

const resolveTypeIdentityMeta = (
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
  options: ReturnType<typeof resolveOpenAPIGeneratorOptions>,
  exportedModuleNamespacePaths: Map<string, string[]>,
  fallbackName?: string,
  identityOptions?: {
    publicTypeReExportsByTarget?: Map<string, PublicTypeReExport[]>
    canonicalOwnerByTarget?: Map<string, string>
    namingContext?: string
    usePublicReExports?: boolean
  }
): TypeIdentityMeta => {
  const symbol = type.aliasSymbol ?? type.getSymbol()
  const declaration = symbol?.declarations?.at(0)
  const name =
    type.aliasSymbol?.escapedName?.toString() ??
    symbol?.getName() ??
    fallbackName ??
    typeChecker.typeToString(type)

  const typeAccessPath = resolveQualifiedTypeName(
    type,
    typeChecker,
    rootNode,
    name
  )
  const declarationNamespaceName = extractNamespaceName(declaration)
  const exportedModuleNamespaceTypeName =
    resolveExportedModuleNamespaceTypeName(
      declaration,
      name,
      typeChecker,
      exportedModuleNamespacePaths
    )

  const shouldUsePublicReExports =
    identityOptions?.usePublicReExports !== false &&
    options.includeTypesNamespaceInName &&
    identityOptions?.publicTypeReExportsByTarget !== undefined

  if (
    shouldUsePublicReExports &&
    options.canonicalTypeOwnership &&
    identityOptions.publicTypeReExportsByTarget
  ) {
    const canonicalIdentity = resolveCanonicalTypeIdentity({
      type,
      typeChecker,
      name,
      declaration,
      typeAccessPath,
      exportedModuleNamespaceTypeName,
      declarationNamespaceName,
      ownershipOptions: options.canonicalTypeOwnership,
      publicTypeReExportsByTarget: identityOptions.publicTypeReExportsByTarget,
      canonicalOwnerByTarget: identityOptions.canonicalOwnerByTarget,
      namingContext: identityOptions.namingContext,
    })
    const qualifiedName = canonicalIdentity.namespaceName
      ? `${canonicalIdentity.namespaceName}.${canonicalIdentity.exportName}`
      : undefined

    return {
      name,
      namespaceName: canonicalIdentity.namespaceName,
      qualifiedName,
      schemaName:
        qualifiedName !== undefined
          ? toOpenAPIComponentName(qualifiedName) || undefined
          : undefined,
    }
  }

  const contextualReExport =
    shouldUsePublicReExports &&
    typeAccessPath === undefined &&
    exportedModuleNamespaceTypeName === undefined
      ? (() => {
          const targetId = resolveUltimateTypeTargetId(type, typeChecker)
          if (!targetId || !identityOptions.publicTypeReExportsByTarget) {
            return undefined
          }
          return selectReExportForContext(
            identityOptions.publicTypeReExportsByTarget.get(targetId) ?? [],
            identityOptions.namingContext
          )
        })()
      : undefined

  const namespaceName =
    typeAccessPath !== undefined
      ? typeAccessPath.split('.').slice(0, -1).join('.')
      : exportedModuleNamespaceTypeName !== undefined
      ? exportedModuleNamespaceTypeName.split('.').slice(0, -1).join('.')
      : contextualReExport !== undefined
      ? contextualReExport.namespacePath
      : declarationNamespaceName
  const qualifiedName =
    typeAccessPath ??
    exportedModuleNamespaceTypeName ??
    contextualReExport?.qualifiedName ??
    (namespaceName ? `${namespaceName}.${name}` : undefined)
  const plainSchemaName = toOpenAPIComponentName(name) || undefined
  const schemaName = options.includeTypesNamespaceInName
    ? qualifiedName !== undefined
      ? toOpenAPIComponentName(qualifiedName) || undefined
      : undefined
    : plainSchemaName !== undefined && plainSchemaName !== name
    ? plainSchemaName
    : undefined

  return {
    name,
    namespaceName,
    qualifiedName,
    schemaName,
  }
}

const namespaceOfQualifiedName = (qualifiedName: string | undefined) =>
  qualifiedName?.split('.').slice(0, -1).join('.')

/**
 * Resolves the namespace of a type when canonical type ownership is enabled:
 * the canonical public re-export, otherwise a public namespace the type is
 * accessible from, otherwise (for unowned types, if enabled) the namespace of
 * the naming context. The first public owner found per type and audience is
 * kept for later usages, so that a type is not named after several owners.
 */
const resolveCanonicalTypeIdentity = ({
  type,
  typeChecker,
  name,
  declaration,
  typeAccessPath,
  exportedModuleNamespaceTypeName,
  declarationNamespaceName,
  ownershipOptions,
  publicTypeReExportsByTarget,
  canonicalOwnerByTarget,
  namingContext,
}: {
  type: ts.Type
  typeChecker: ts.TypeChecker
  name: string
  declaration: ts.Declaration | undefined
  typeAccessPath: string | undefined
  exportedModuleNamespaceTypeName: string | undefined
  declarationNamespaceName: string | undefined
  ownershipOptions: CanonicalTypeOwnershipOptions
  publicTypeReExportsByTarget: Map<string, PublicTypeReExport[]>
  canonicalOwnerByTarget: Map<string, string> | undefined
  namingContext: string | undefined
}): { namespaceName: string | undefined; exportName: string } => {
  const { namespacePattern, sharedAudience } = ownershipOptions
  const publicNamespace = (namespacePath: string | undefined) =>
    matchPublicNamespace(namespacePath, namespacePattern) !== undefined
      ? namespacePath
      : undefined

  const targetId = !isBuiltInTypeName(name)
    ? resolveUltimateTypeTargetId(type, typeChecker)
    : undefined
  const isRouteScoped =
    ownershipOptions.routeScopedTypeModules !== undefined &&
    declaration !== undefined &&
    // `search` ignores the `lastIndex` state of global patterns
    declaration
      .getSourceFile()
      .fileName.search(ownershipOptions.routeScopedTypeModules) !== -1
  const canonicalReExport =
    !isRouteScoped && targetId
      ? selectCanonicalPublicReExport(
          publicTypeReExportsByTarget.get(targetId) ?? [],
          name,
          namingContext,
          namespacePattern,
          sharedAudience
        )
      : undefined

  // anonymous types and primitives always take the namespace of their context,
  // which is propagated to the types nested within them
  const shouldInheritNamespace =
    name !== 'void' &&
    !(type.flags & ts.TypeFlags.EnumLike) &&
    (!targetId ||
      !isTrackableNamedType(name) ||
      isRouteScoped ||
      ownershipOptions.inheritRouteNamespaceForUnownedTypes === true)
  const inheritedNamespace = shouldInheritNamespace
    ? publicNamespace(namingContext)
    : undefined

  let namespaceName = isRouteScoped
    ? inheritedNamespace
    : canonicalReExport?.namespacePath ??
      publicNamespace(namespaceOfQualifiedName(typeAccessPath)) ??
      publicNamespace(
        namespaceOfQualifiedName(exportedModuleNamespaceTypeName)
      ) ??
      inheritedNamespace ??
      declarationNamespaceName

  const owner = matchPublicNamespace(namespaceName, namespacePattern)
  if (
    targetId &&
    owner &&
    namespaceName &&
    !isRouteScoped &&
    canonicalOwnerByTarget
  ) {
    const ownershipKey = `${targetId}#${owner.audience ?? ''}`
    const existingOwner = canonicalOwnerByTarget.get(ownershipKey)

    if (existingOwner !== undefined && existingOwner !== namespaceName) {
      // an unowned type used by another version keeps the namespace of its first usage
      if (
        canonicalReExport === undefined &&
        matchPublicNamespace(existingOwner, namespacePattern)?.version !==
          owner.version
      ) {
        namespaceName = existingOwner
      } else {
        throw new Error(
          `Ambiguous canonical public type ownership for ${name}: ${existingOwner}, ${namespaceName}`
        )
      }
    }

    canonicalOwnerByTarget.set(ownershipKey, namespaceName)
  }

  return {
    namespaceName,
    exportName: canonicalReExport?.exportName ?? name,
  }
}

const deriveNamingContext = (
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
  options: ReturnType<typeof resolveOpenAPIGeneratorOptions>,
  exportedModuleNamespacePaths: Map<string, string[]>
): string | undefined => {
  const tryDerive = (candidate: ts.Type): string | undefined => {
    const identity = resolveTypeIdentityMeta(
      candidate,
      typeChecker,
      rootNode,
      options,
      exportedModuleNamespacePaths,
      undefined,
      { usePublicReExports: false }
    )
    if (identity.namespaceName) {
      return identity.namespaceName
    }

    if (candidate.aliasTypeArguments?.length) {
      for (const typeArgument of candidate.aliasTypeArguments) {
        const nestedContext = tryDerive(typeArgument)
        if (nestedContext) {
          return nestedContext
        }
      }
    }

    const typeReference = candidate as ts.TypeReference
    if (typeReference.typeArguments?.length) {
      for (const typeArgument of typeReference.typeArguments) {
        const nestedContext = tryDerive(typeArgument)
        if (nestedContext) {
          return nestedContext
        }
      }
    }

    return undefined
  }

  return tryDerive(type)
}

const resolveTypeIdentityMetaFromTraverse = (
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
  metadata: TraverseMeta,
  fallbackName?: string
) =>
  resolveTypeIdentityMeta(
    type,
    typeChecker,
    rootNode,
    metadata.options,
    metadata.exportedModuleNamespacePaths,
    fallbackName,
    {
      publicTypeReExportsByTarget: metadata.publicTypeReExportsByTarget,
      canonicalOwnerByTarget: metadata.canonicalOwnerByTarget,
      namingContext: metadata.namingContext,
      usePublicReExports: true,
    }
  )

// with canonical type ownership, the types nested within a type are named in
// the context of its namespace
const withPropagatedNamingContext = (
  metadata: TraverseMeta,
  typeIdentity: TypeIdentityMeta
): TraverseMeta =>
  metadata.options.canonicalTypeOwnership &&
  typeIdentity.namespaceName &&
  typeIdentity.namespaceName !== metadata.namingContext
    ? { ...metadata, namingContext: typeIdentity.namespaceName }
    : metadata

const identityFields = (typeIdentity: TypeIdentityMeta) => ({
  ...(typeIdentity.namespaceName !== undefined
    ? { namespaceName: typeIdentity.namespaceName }
    : {}),
  ...(typeIdentity.qualifiedName !== undefined
    ? { qualifiedName: typeIdentity.qualifiedName }
    : {}),
  ...(typeIdentity.schemaName !== undefined
    ? { schemaName: typeIdentity.schemaName }
    : {}),
})

const getBuiltInType = (
  symbol: ts.Symbol | undefined,
  typeAsString: string
): TypeDefinition | null => {
  const builtInTypeName = symbol?.name ?? symbol?.escapedName?.toString()
  if (builtInTypeName === 'Date') {
    return {
      kind: 'date' as const,
    }
  }
  if (
    builtInTypeName?.endsWith('Buffer') ||
    typeAsString.endsWith('Buffer') ||
    (builtInTypeName !== undefined && isBinaryTypeName(builtInTypeName))
  ) {
    return {
      kind: 'buffer' as const,
    }
  }
  if (builtInTypeName === 'BigInt') {
    return {
      kind: 'bigint' as const,
    }
  }
  if (builtInTypeName === 'Symbol') {
    return {
      kind: 'symbol' as const,
    }
  }
  if (builtInTypeName === 'Map') {
    return {
      kind: 'map' as const,
    }
  }
  if (builtInTypeName === 'Set') {
    return {
      kind: 'set' as const,
    }
  }
  if (builtInTypeName === 'RegExp') {
    return {
      kind: 'regexp' as const,
    }
  }
  if (builtInTypeName === 'Stream') {
    return {
      kind: 'stream' as const,
    }
  }

  return null
}

const getPrimitiveType = (type: ts.Type): TypeDefinition | null => {
  if (type.flags & ts.TypeFlags.BigIntLike) {
    return { kind: 'bigint' }
  }
  if (type.flags & ts.TypeFlags.ESSymbolLike) {
    return { kind: 'symbol' }
  }
  if (type.flags & ts.TypeFlags.Any) {
    return { kind: 'any' }
  }
  if (type.flags & ts.TypeFlags.Unknown) {
    return { kind: 'unknown' }
  }
  // computed enum members, e.g. `Large = 'large'.length`, are numbers
  if (
    type.flags & ts.TypeFlags.EnumLike &&
    !type.isUnion() &&
    !type.isLiteral()
  ) {
    return { kind: 'number' }
  }

  return null
}

// subclasses of node streams, e.g. `Readable`
const extendsStream = (
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  seen = new Set<ts.Type>()
): boolean => {
  if (!type.isClassOrInterface() || seen.has(type)) {
    return false
  }
  seen.add(type)

  return (typeChecker.getBaseTypes(type) ?? []).some(
    (baseType) =>
      baseType.getSymbol()?.getName() === 'Stream' ||
      extendsStream(baseType, typeChecker, seen)
  )
}

const transformEnumLiteralsToIntermediate = (
  types: ts.Type[],
  typeChecker: ts.TypeChecker
): TypeDefinition | undefined => {
  if (!types.every((t) => t.flags & ts.TypeFlags.EnumLike)) {
    return undefined
  }

  const enumSymbol = typeChecker.getBaseTypeOfLiteralType(types[0]).getSymbol()

  // enums with computed members only have known values for their literal members.
  // Computed members are numbers, so the numeric members widen to `number`,
  // while the string members of heterogeneous enums remain known
  if (types.some((t) => !t.isStringLiteral() && !t.isNumberLiteral())) {
    const stringValues = types.flatMap((t) =>
      t.isStringLiteral() ? [t.value] : []
    )
    return stringValues.length > 0
      ? {
          kind: 'union',
          types: [
            {
              kind: 'enum',
              values: stringValues,
              type: 'string',
              name: enumSymbol?.name ?? '',
            },
            { kind: 'number' },
          ],
        }
      : { kind: 'number' }
  }

  const values = types.map(
    (t) => (t as ts.LiteralType).value as string | number
  )

  return {
    kind: 'enum',
    values,
    type: values.every((value) => typeof value === 'string')
      ? 'string'
      : 'number',
    name: enumSymbol?.name ?? '',
  }
}

function transformTypeToIntermediate(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
  metadata: TraverseMeta
): TypeDefinition {
  if (!type) throw new Error('Type is undefined')

  // a type reached again while it is expanded is recursive
  const recursionDepth = metadata.expandingTypes.get(type) ?? 0
  metadata.expandingTypes.set(type, recursionDepth + 1)
  try {
    return transformTypeToIntermediateOnce(
      type,
      typeChecker,
      rootNode,
      metadata,
      recursionDepth
    )
  } finally {
    if (recursionDepth === 0) {
      metadata.expandingTypes.delete(type)
    } else {
      metadata.expandingTypes.set(type, recursionDepth)
    }
  }
}

function transformTypeToIntermediateOnce(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
  metadata: TraverseMeta,
  recursionDepth: number
): TypeDefinition {
  // Get type name and handle generic types
  const symbol = type.getSymbol()
  const typeRef = type as ts.TypeReference
  let typeName = type.aliasSymbol?.escapedName?.toString()

  // Only object-like generic aliases (e.g. `Paginated<T> = { items: T[] }`)
  // are expanded structurally here. Aliases resolving to unions, arrays,
  // tuples or primitives (e.g. `Nullable<T> = T | null`, `List<T> = T[]`)
  // are handled by the regular type handling below.
  const isObjectLikeGenericAlias =
    type.isIntersection() ||
    ((type.flags & ts.TypeFlags.Object) !== 0 &&
      !typeChecker.isArrayType(type) &&
      !typeChecker.isTupleType(type))

  if (typeRef.aliasTypeArguments?.length && isObjectLikeGenericAlias) {
    // recursive generic aliases are expanded structurally, without a component to reference
    if (recursionDepth > 1) {
      return { kind: 'unknown' }
    }

    const baseTypeName =
      typeName || symbol?.getName() || typeChecker.typeToString(type)

    if (baseTypeName === 'Record') {
      const recordKeyType = typeRef.aliasTypeArguments?.at(0)
      if (recordKeyType && (recordKeyType.flags & ts.TypeFlags.Never) !== 0) {
        return {
          kind: 'object',
          properties: {},
        }
      }

      const stringIndexType = typeChecker.getIndexInfoOfType(
        type,
        ts.IndexKind.String
      )
      if (stringIndexType && stringIndexType.type) {
        if (typeChecker.typeToString(stringIndexType.type) === 'never') {
          return {
            kind: 'object',
            properties: {},
          }
        }

        return {
          kind: 'record',
          value: transformTypeToIntermediate(
            stringIndexType.type,
            typeChecker,
            rootNode,
            metadata
          ),
        }
      }
    } else if (baseTypeName === 'Omit' || baseTypeName === 'Pick') {
      // Get the type arguments for Omit/Pick
      const [originalType, keysType] = typeRef.aliasTypeArguments || []
      if (!originalType) {
        throw new Error(`Invalid ${baseTypeName} type parameters`)
      }

      // Get the actual type that results from applying Omit/Pick
      const apparentType = typeChecker.getApparentType(originalType)
      metadata = withPropagatedNamingContext(
        metadata,
        resolveTypeIdentityMetaFromTraverse(
          originalType,
          typeChecker,
          rootNode,
          metadata
        )
      )

      // Get the keys to keep/remove
      const keys = new Set<string>()
      if (keysType?.isUnion()) {
        keysType.types.forEach((t) => {
          if (t.isStringLiteral()) {
            keys.add(t.value)
          }
        })
      } else if (keysType?.isStringLiteral()) {
        keys.add(keysType.value)
      }

      // Handle union types
      if (apparentType.isUnion()) {
        return {
          kind: 'union',
          types: apparentType.types
            .filter((unionType) => {
              if (!unionType.isLiteral()) return true
              const literalValue = unionType.isStringLiteral()
                ? unionType.value
                : String(unionType.value)
              return baseTypeName === 'Pick'
                ? keys.has(literalValue)
                : !keys.has(literalValue)
            })
            .map((unionType) => {
              if (unionType.isLiteral()) {
                // For literal types, just pass them through
                return transformTypeToIntermediate(
                  unionType,
                  typeChecker,
                  rootNode,
                  metadata
                )
              }

              // For object types, apply the Pick/Omit logic
              const properties = unionType.getProperties()
              const resultProperties: Record<string, TypeDefinition> = {}
              const required = new Set<string>()

              properties.forEach((prop) => {
                if (isIgnoredSyntheticPropertyName(prop.name)) {
                  return
                }

                const shouldInclude =
                  baseTypeName === 'Pick'
                    ? keys.has(prop.name)
                    : !keys.has(prop.name)

                if (shouldInclude) {
                  const propType = typeChecker.getTypeOfSymbolAtLocation(
                    prop,
                    rootNode
                  )
                  resultProperties[prop.name] = transformTypeToIntermediate(
                    propType,
                    typeChecker,
                    rootNode,
                    metadata
                  )

                  if (!(prop.flags & ts.SymbolFlags.Optional)) {
                    required.add(prop.name)
                  }
                }
              })

              return {
                kind: 'object',
                properties: resultProperties,
                ...(required.size > 0
                  ? { required: Array.from(required) }
                  : {}),
              }
            }),
        }
      }

      // Continue with regular object type handling
      const properties = apparentType.getProperties()
      const resultProperties: Record<string, TypeDefinition> = {}
      const required = new Set<string>()

      properties.forEach((prop) => {
        if (isIgnoredSyntheticPropertyName(prop.name)) {
          return
        }

        const shouldInclude =
          baseTypeName === 'Pick' ? keys.has(prop.name) : !keys.has(prop.name)

        if (shouldInclude) {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)
          resultProperties[prop.name] = transformTypeToIntermediate(
            propType,
            typeChecker,
            rootNode,
            metadata
          )

          if (!(prop.flags & ts.SymbolFlags.Optional)) {
            required.add(prop.name)
          }
        }
      })

      return {
        kind: 'object',
        properties: resultProperties,
        ...(required.size > 0 ? { required: Array.from(required) } : {}),
      }
    }

    // Get the generic type structure
    const properties: Record<string, TypeDefinition> = {}
    const required = new Set<string>()

    type.getApparentProperties().forEach((prop) => {
      if (isIgnoredSyntheticPropertyName(prop.name)) {
        return
      }

      const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)
      properties[prop.name] = transformTypeToIntermediate(
        propType,
        typeChecker,
        rootNode,
        metadata
      )

      if (!(prop.flags & ts.SymbolFlags.Optional)) {
        required.add(prop.name)
      }
    })

    return {
      kind: 'generic',
      name: baseTypeName,
      structure: {
        kind: 'object',
        properties,
        ...(required.size > 0 ? { required: Array.from(required) } : {}),
      },
    }
  }

  // Improve type name detection - try multiple sources
  if (!typeName) {
    typeName = symbol?.getName()
  }
  if (!typeName && type.aliasSymbol) {
    typeName = type.aliasSymbol.getName()
  }
  // For types that don't have alias symbols but have symbols (like interface/type references)
  if (!typeName && symbol && symbol.name && symbol.name !== '__type') {
    typeName = symbol.name
  }
  if (!typeName) {
    typeName = typeChecker.typeToString(type)
  }
  const typeIdentity = resolveTypeIdentityMetaFromTraverse(
    type,
    typeChecker,
    rootNode,
    metadata,
    typeName
  )
  metadata = withPropagatedNamingContext(metadata, typeIdentity)
  const visitKey = typeIdentity.qualifiedName ?? typeName
  const typeAsString = typeChecker.typeToString(type)

  typeDiscoveryLog('typeName %s', typeName)
  typeDiscoveryLog('symbol name: %s', symbol?.name)
  typeDiscoveryLog('symbol escapedName: %s', symbol?.escapedName)
  typeDiscoveryLog('aliasSymbol name: %s', type.aliasSymbol?.name)
  typeDiscoveryLog('aliasSymbol escapedName: %s', type.aliasSymbol?.escapedName)
  typeDiscoveryLog('typeToString: %s', typeAsString)
  typeDiscoveryLog('visitedTypes %s', metadata.visitedTypes)
  typeDiscoveryLog('namingContext %s', metadata.namingContext)

  const builtInType =
    getBuiltInType(symbol, typeAsString) ??
    (extendsStream(type, typeChecker) ? { kind: 'stream' as const } : null)
  if (builtInType?.kind === 'set') {
    const elementType =
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? typeChecker.getTypeArguments(type as ts.TypeReference).at(0)
        : undefined
    return {
      kind: 'array',
      items: elementType
        ? transformTypeToIntermediate(
            elementType,
            typeChecker,
            rootNode,
            metadata
          )
        : { kind: 'unknown' },
      uniqueItems: true,
    }
  }
  if (builtInType) {
    return builtInType
  }

  // primitives without properties of their own, which must not be expanded
  // through the members of their apparent wrapper types
  const primitiveType = getPrimitiveType(type)
  if (primitiveType) {
    return primitiveType
  }

  // Check for recursion - but only for named types that aren't basic types
  if (
    isTrackableNamedType(typeIdentity.name ?? typeName) &&
    metadata.visitedTypes?.has(visitKey)
  ) {
    return {
      kind: 'ref',
      name: typeIdentity.name ?? typeName,
      ...identityFields(typeIdentity),
    }
  }

  // recursive named unions, e.g. `type Json = string | Json[]`, become components
  if (
    recursionDepth > 0 &&
    type.isUnion() &&
    isTrackableNamedType(typeIdentity.name ?? typeName)
  ) {
    metadata.recursiveUnionTypes.add(type)
    return {
      kind: 'ref',
      name: typeIdentity.name ?? typeName,
      ...identityFields(typeIdentity),
      ...(type.types.some((t) => t.flags & ts.TypeFlags.Null)
        ? { nullable: true }
        : {}),
    }
  }

  // anonymous recursive types, e.g. inferred from recursive zod schemas, have no
  // name to reference, so the recursion is cut off with an unconstrained schema.
  // Types reached once more are still expanded, since they may lead to a named
  // recursive type, e.g. `Json[]` within `type Json = string | Json[]`
  if (recursionDepth > 1) {
    typeDiscoveryLog('Anonymous recursive type: %s', typeAsString)
    return { kind: 'unknown' }
  }

  // Handle unions first, before array detection
  if (type.isUnion()) {
    // `null` makes the resulting schema nullable, `undefined` only marks optionality
    const isNullable = type.types.some(
      (t) => (t.flags & ts.TypeFlags.Null) !== 0
    )
    const nonNullTypes = type.types.filter(
      (t) =>
        (t.flags & ts.TypeFlags.Null) === 0 &&
        (t.flags & ts.TypeFlags.Undefined) === 0
    )
    const withNullability = (definition: TypeDefinition): TypeDefinition =>
      isNullable ? { ...definition, nullable: true } : definition

    if (nonNullTypes.length === 0) {
      return { kind: 'null' }
    }

    const booleanLiteralTypes = nonNullTypes.filter(
      (t) => t.flags & ts.TypeFlags.BooleanLiteral
    )
    // `boolean` is represented as `true | false` within unions
    const containsBoolean = booleanLiteralTypes.length === 2

    // Check if this is a boolean represented as true | false
    if (containsBoolean && nonNullTypes.length === 2) {
      return withNullability({
        kind: 'boolean',
      })
    }

    // A single remaining member (e.g. `T | null` or `T | undefined`) is unwrapped
    if (nonNullTypes.length === 1) {
      const memberDefinition = transformTypeToIntermediate(
        nonNullTypes[0],
        typeChecker,
        rootNode,
        metadata
      )

      // unless the member referenced the union recursively, e.g.
      // `type Tree = { child: Tree } | null`, which then needs its component
      return withNullability(
        metadata.recursiveUnionTypes.has(type)
          ? {
              kind: 'union',
              types: [memberDefinition],
              name: typeIdentity.name ?? typeName,
              ...identityFields(typeIdentity),
            }
          : memberDefinition
      )
    }

    // Native TS enums are unions of enum literal types
    const enumDefinition = transformEnumLiteralsToIntermediate(
      nonNullTypes,
      typeChecker
    )
    if (enumDefinition) {
      return withNullability(enumDefinition)
    }

    // collapse `true | false` into a single `boolean` member
    const unionTypes = nonNullTypes.flatMap((t): TypeDefinition[] =>
      containsBoolean && t.flags & ts.TypeFlags.BooleanLiteral
        ? t === booleanLiteralTypes[0]
          ? [{ kind: 'boolean' }]
          : []
        : [transformTypeToIntermediate(t, typeChecker, rootNode, metadata)]
    )

    return withNullability({
      kind: 'union',
      types: unionTypes,
      // named after its members referenced it recursively
      ...(metadata.recursiveUnionTypes.has(type)
        ? {
            name: typeIdentity.name ?? typeName,
            ...identityFields(typeIdentity),
          }
        : {}),
    })
  }

  // Handle arrays after union detection
  if (
    symbol?.name === 'Array' ||
    typeChecker.isArrayType(type) ||
    typeAsString === '[]' ||
    typeAsString.endsWith('[]')
  ) {
    const elementType = (type as ts.TypeReference).typeArguments?.at(0)

    // Handle regular array
    return {
      kind: 'array',
      ...(elementType
        ? {
            items: transformTypeToIntermediate(
              elementType,
              typeChecker,
              rootNode,
              metadata
            ),
          }
        : {}),
      ...(!elementType ? { maxItems: 0 } : {}),
    }
  }

  // Check for tuple types - but be more specific to avoid catching empty arrays
  const objectType = type as ts.ObjectType

  // Multiple ways to detect tuple types - but exclude empty arrays
  const isTuple =
    (objectType.objectFlags & ts.ObjectFlags.Tuple ||
      (objectType.objectFlags & ts.ObjectFlags.Reference &&
        (objectType as ts.TypeReference).target?.objectFlags &
          ts.ObjectFlags.Tuple)) &&
    typeAsString !== '[]' // Exclude empty arrays from tuple detection

  if (isTuple) {
    typeDiscoveryLog('Found tuple type: %s', typeChecker.typeToString(type))

    const tupleTarget = (
      objectType.objectFlags & ts.ObjectFlags.Tuple
        ? objectType
        : (type as ts.TypeReference).target
    ) as ts.TupleType

    // optional and rest elements are part of the type arguments as well,
    // e.g. `number` for `number?` and `string` for `...string[]`
    const elementTypes = typeChecker
      .getTypeArguments(type as ts.TypeReference)
      .map((elementType) => {
        const constraint =
          elementType.flags & ts.TypeFlags.TypeParameter
            ? (elementType as ts.TypeParameter).getConstraint()
            : undefined
        return transformTypeToIntermediate(
          constraint ?? elementType,
          typeChecker,
          rootNode,
          metadata
        )
      })

    typeDiscoveryLog('Tuple elements: %d', elementTypes.length)
    return {
      kind: 'tuple',
      elementTypes,
      ...(tupleTarget.minLength !== elementTypes.length
        ? { minItems: tupleTarget.minLength }
        : {}),
      ...(tupleTarget.hasRestElement ? { hasRestElement: true } : {}),
    }
  }

  // Basic types handling
  if (type.isStringLiteral()) {
    return {
      kind: 'literal',
      value: type.value,
    }
  }

  if (type.isNumberLiteral()) {
    return {
      kind: 'literal',
      value: type.value,
    }
  }

  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return {
      kind: 'literal',
      value: typeAsString === 'true',
    }
  }

  // Handle intersections
  if (type.isIntersection()) {
    // Filter out 'never' types and BRAND types
    const validTypes = type.types.filter((t) => {
      const typeName = t.aliasSymbol?.escapedName?.toString()
      return !(t.flags & ts.TypeFlags.Never) && typeName !== 'BRAND' // zod branded types should be ignored
    })
    // intersections with unions, e.g. `Base & (Bundle | Single)`, never reach this point,
    // since TypeScript distributes them into unions of intersections

    const isObjectType = (t: ts.Type) =>
      t.isClassOrInterface() || (t.flags & ts.TypeFlags.Object) !== 0
    const hasProperties = validTypes.some((t) =>
      t
        .getProperties()
        .some((prop) => !isIgnoredSyntheticPropertyName(prop.name))
    )

    // Intersections with non-object members (or without any properties) are kept as `allOf`.
    // They never become a named component, so they must not be tracked as visited.
    if (!validTypes.every(isObjectType) || !hasProperties) {
      return {
        kind: 'intersection',
        types: validTypes.map((t) =>
          transformTypeToIntermediate(t, typeChecker, rootNode, metadata)
        ),
      }
    }

    // Get all properties from all object types in the intersection
    const properties: Record<string, TypeDefinition> = {}
    const required = new Set<string>()

    // we want to track named intersection types to not re-visit them again
    // important that we add this first before traversing the properties, because it could be a recursive type
    const intersectionTypeName = type.aliasSymbol?.escapedName?.toString()
    const intersectionTypeIdentity = resolveTypeIdentityMetaFromTraverse(
      type,
      typeChecker,
      rootNode,
      metadata,
      intersectionTypeName
    )
    const intersectionVisitKey =
      intersectionTypeIdentity.qualifiedName ?? intersectionTypeName
    const shouldTrackIntersectionType = isTrackableNamedType(
      intersectionTypeIdentity.name
    )

    if (shouldTrackIntersectionType && intersectionVisitKey !== undefined) {
      metadata.visitedTypes?.add(intersectionVisitKey)
    }

    validTypes.forEach((t) => {
      t.getProperties().forEach((prop) => {
        if (isIgnoredSyntheticPropertyName(prop.name)) {
          return
        }

        const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)
        properties[prop.name] = transformTypeToIntermediate(
          propType,
          typeChecker,
          rootNode,
          metadata
        )
        if (!(prop.flags & ts.SymbolFlags.Optional)) {
          required.add(prop.name)
        }
      })
    })

    return {
      kind: 'object',
      properties,
      ...(required.size > 0 ? { required: Array.from(required) } : {}),
      ...(shouldTrackIntersectionType
        ? {
            name: intersectionTypeIdentity.name ?? intersectionTypeName,
            ...identityFields(intersectionTypeIdentity),
          }
        : {}),
    }
  }

  // Check for object types (including interfaces and type aliases)
  if (
    type.isClassOrInterface() ||
    (type.flags & ts.TypeFlags.Object && type.getProperties().length > 0)
  ) {
    // Determine if this is a named type that should be tracked
    // We want to track types that have proper names (not anonymous object types or basic types)
    const shouldTrackType = isTrackableNamedType(typeIdentity.name)

    // Check if this is the first visit to this named type
    const isFirstVisit = shouldTrackType
      ? !metadata.visitedTypes?.has(visitKey)
      : true

    if (shouldTrackType) {
      metadata.visitedTypes?.add(visitKey)
    }

    const objectSchema = transformObjectToIntermediate(
      type,
      typeChecker,
      rootNode,
      metadata
    )

    return {
      ...objectSchema,
      ...(shouldTrackType && isFirstVisit
        ? {
            name: typeIdentity.name ?? typeName,
            ...identityFields(typeIdentity),
          }
        : {}),
    }
  }

  const basicTypeMap: Record<string, TypeDefinition> = {
    string: { kind: 'string' },
    number: { kind: 'number' },
    boolean: { kind: 'boolean' },
    null: { kind: 'null' },
  }

  return (
    basicTypeMap[typeAsString] ||
    transformObjectToIntermediate(type, typeChecker, rootNode, metadata)
  )
}

function transformObjectToIntermediate(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
  metadata: TraverseMeta
): ObjectType {
  const properties: Record<string, TypeDefinition> = {}
  const required = new Set<string>()

  const typeName = type.aliasSymbol?.escapedName?.toString()
  const typeIdentity = resolveTypeIdentityMetaFromTraverse(
    type,
    typeChecker,
    rootNode,
    metadata,
    typeName
  )
  const visitKey = typeIdentity.qualifiedName ?? typeName

  // Only track and name proper named types, not anonymous ones
  const shouldTrackType = isTrackableNamedType(typeIdentity.name)

  // we want to track named object types to not re-visit them again
  if (shouldTrackType && visitKey !== undefined) {
    metadata.visitedTypes?.add(visitKey)
  }

  type.getProperties().forEach((prop) => {
    if (isIgnoredSyntheticPropertyName(prop.name)) {
      return
    }

    const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)

    // Check if the property type is a union that includes null
    let isNullable = false
    if (propType.isUnion()) {
      isNullable = propType.types.some(
        (t) => (t.flags & ts.TypeFlags.Null) !== 0
      )
    }

    // Transform the property type
    properties[prop.name] = transformTypeToIntermediate(
      propType,
      typeChecker,
      rootNode,
      metadata
    )

    // Set nullable flag if needed
    if (isNullable) {
      properties[prop.name].nullable = true
    }

    if (!(prop.flags & ts.SymbolFlags.Optional)) {
      required.add(prop.name)
    }
  })

  // index signatures, e.g. `{ [key: string]: Json }`, describe the remaining properties
  const indexInfo =
    typeChecker.getIndexInfoOfType(type, ts.IndexKind.String) ??
    typeChecker.getIndexInfoOfType(type, ts.IndexKind.Number)

  return {
    kind: 'object',
    properties,
    ...(required.size > 0 ? { required: Array.from(required) } : {}),
    ...(indexInfo
      ? {
          additionalProperties: transformTypeToIntermediate(
            indexInfo.type,
            typeChecker,
            rootNode,
            metadata
          ),
        }
      : {}),
    ...(shouldTrackType
      ? {
          name: typeIdentity.name ?? typeName,
          ...identityFields(typeIdentity),
        }
      : {}),
  }
}

export function getOpenAPI3Spec(rootType: TypeDefinition, replaceRefs = true) {
  const components: Record<string, any> = {}
  const spec = resolveTypeToOpenAPI3({
    type: rootType,
    components,
    replaceRefs,
  })

  return {
    spec,
    components,
    ambiguousComponents: [
      ...(ambiguousComponentsByRegistry.get(components) ?? []),
    ],
  }
}

// component keys that were registered with different shapes, per component registry
const ambiguousComponentsByRegistry = new WeakMap<
  Record<string, any>,
  Set<string>
>()

const registerComponent = (
  components: Record<string, any>,
  componentKey: string,
  schema: unknown
) => {
  const existing = components[componentKey]
  if (
    existing !== undefined &&
    hashOpenAPISchema(existing) !== hashOpenAPISchema(schema)
  ) {
    const ambiguousComponents =
      ambiguousComponentsByRegistry.get(components) ?? new Set<string>()
    ambiguousComponents.add(componentKey)
    ambiguousComponentsByRegistry.set(components, ambiguousComponents)
  }

  components[componentKey] = schema
}

type ResolveTypeToOpenAPI3Args = {
  type: TypeDefinition
  components: Record<string, any>
  replaceRefs: boolean
}

// OpenAPI 3.0 applies `nullable` only alongside an explicit `type` in the same schema
// and ignores siblings of `$ref`, so schemas without a `type` accept null through this
// null-only alternative instead
const NULL_SCHEMA = { type: 'string', enum: [null], nullable: true }

const withNullAlternative = (
  schema: Record<string, unknown>,
  nullable: boolean
) => (nullable ? { oneOf: [schema, NULL_SCHEMA] } : schema)

// lifts `null` members and member nullability out of (nested) unions, keeping nested
// unions as their own alternatives since flattening overlapping members into a single
// `oneOf` would reject values matching several of them
const stripUnionNullability = (
  type: TypeDefinition
): { type: TypeDefinition | null; nullable: boolean } => {
  if (type.kind === 'null') {
    return { type: null, nullable: true }
  }
  if (type.kind !== 'union') {
    return {
      type: type.nullable ? { ...type, nullable: false } : type,
      nullable: type.nullable === true,
    }
  }

  const members = type.types.map(stripUnionNullability)
  const nonNullTypes = members.flatMap((m) => (m.type ? [m.type] : []))
  const nullable = type.nullable === true || members.some((m) => m.nullable)

  if (nonNullTypes.length <= 1) {
    return { type: nonNullTypes[0] ?? null, nullable }
  }
  return { type: { ...type, types: nonNullTypes, nullable: false }, nullable }
}

function resolveTypeToOpenAPI3({
  type,
  components,
  replaceRefs,
}: ResolveTypeToOpenAPI3Args): any {
  const nullable = type.nullable === true

  switch (type.kind) {
    case 'string':
      return {
        type: 'string',
        ...(type.format !== undefined ? { format: type.format } : {}),
        ...(type.pattern !== undefined ? { pattern: type.pattern } : {}),
        ...(type.minLength !== undefined ? { minLength: type.minLength } : {}),
        ...(type.maxLength !== undefined ? { maxLength: type.maxLength } : {}),
        ...(nullable ? { nullable: true } : {}),
      }
    case 'number':
      return {
        type: 'number',
        ...(type.format !== undefined ? { format: type.format } : {}),
        ...(type.minimum !== undefined ? { minimum: type.minimum } : {}),
        ...(type.maximum !== undefined ? { maximum: type.maximum } : {}),
        ...(type.multipleOf !== undefined
          ? { multipleOf: type.multipleOf }
          : {}),
        ...(nullable ? { nullable: true } : {}),
      }
    case 'boolean':
      return {
        type: 'boolean',
        ...(nullable ? { nullable: true } : {}),
      }
    case 'null':
      return NULL_SCHEMA
    case 'array': {
      const items = type.items
        ? resolveTypeToOpenAPI3({
            type: type.items,
            components,
            replaceRefs,
          })
        : undefined
      return {
        type: 'array',
        items,
        ...(type.minItems !== undefined ? { minItems: type.minItems } : {}),
        ...(type.maxItems !== undefined ? { maxItems: type.maxItems } : {}),
        ...(type.uniqueItems !== undefined
          ? { uniqueItems: type.uniqueItems }
          : {}),
        ...(nullable ? { nullable: true } : {}),
      }
    }
    case 'tuple': {
      // OpenAPI 3.0 does not support positional `items`, so tuples become
      // arrays of bounded length whose items match any of the element schemas.
      // Element schemas may overlap (e.g. `[number, 1]`), hence `anyOf` over `oneOf`
      const items = uniqWith(
        type.elementTypes.map((t) =>
          resolveTypeToOpenAPI3({ type: t, components, replaceRefs })
        ),
        isEqual
      )
      return {
        type: 'array',
        items:
          items.length === 0
            ? {}
            : items.length === 1
            ? items[0]
            : { anyOf: items },
        minItems: type.minItems ?? type.elementTypes.length,
        ...(!type.hasRestElement ? { maxItems: type.elementTypes.length } : {}),
        ...(nullable ? { nullable: true } : {}),
      }
    }
    case 'object': {
      const baseObjectSpec = {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(type.properties).map(([key, value]) => [
            key,
            resolveTypeToOpenAPI3({ type: value, components, replaceRefs }),
          ])
        ),
        ...(type.required ? { required: type.required } : {}),
        ...(type.additionalProperties !== undefined
          ? {
              additionalProperties:
                typeof type.additionalProperties === 'boolean'
                  ? type.additionalProperties
                  : resolveTypeToOpenAPI3({
                      type: type.additionalProperties,
                      components,
                      replaceRefs,
                    }),
            }
          : {}),
      }

      if (type.name) {
        const componentKey = type.schemaName ?? type.name
        registerComponent(components, componentKey, baseObjectSpec)

        if (replaceRefs) {
          return withNullAlternative(
            { $ref: `#/components/schemas/${componentKey}` },
            nullable
          )
        }
      }

      return {
        ...baseObjectSpec,
        ...(nullable ? { nullable: true } : {}),
      }
    }
    case 'record': {
      return {
        type: 'object',
        additionalProperties: resolveTypeToOpenAPI3({
          type: type.value,
          components,
          replaceRefs,
        }),
        ...(nullable ? { nullable: true } : {}),
      }
    }
    case 'union': {
      // `null` members and member nullability are expressed via a single null-only
      // alternative, since `oneOf` rejects null when several alternatives accept it
      const { type: nonNullType, nullable: isNullable } =
        stripUnionNullability(type)

      if (nonNullType === null) {
        return NULL_SCHEMA
      }
      if (type.name) {
        // recursive unions are components, references to them accept null instead
        const componentKey = type.schemaName ?? type.name
        const {
          name: _name,
          namespaceName: _namespaceName,
          qualifiedName: _qualifiedName,
          schemaName: _schemaName,
          ...componentType
        } = nonNullType
        // a single non-null member keeps its own name, e.g. an interface of its own
        const isSingleMember =
          nonNullType.kind !== 'union' || nonNullType.name !== type.name
        registerComponent(
          components,
          componentKey,
          resolveTypeToOpenAPI3({
            type: isSingleMember
              ? nonNullType
              : (componentType as TypeDefinition),
            components,
            replaceRefs,
          })
        )

        if (replaceRefs) {
          return withNullAlternative(
            { $ref: `#/components/schemas/${componentKey}` },
            isNullable
          )
        }
      }
      if (nonNullType.kind !== 'union') {
        return resolveTypeToOpenAPI3({
          type: { ...nonNullType, nullable: isNullable },
          components,
          replaceRefs,
        })
      }
      const nonNullTypes = nonNullType.types

      const unionTypes = uniqWith(
        nonNullTypes.map((t) =>
          resolveTypeToOpenAPI3({ type: t, components, replaceRefs })
        ),
        isEqual
      )
      // an unconstrained member accepts every value, and would make `oneOf` ambiguous
      if (unionTypes.some((t) => isEqual(t, {}))) {
        return {}
      }
      if (unionTypes.every((t) => t.enum)) {
        return resolveEnumToOpenAPI3(
          unionTypes.flatMap((t) => t.enum),
          isNullable
        )
      }
      return {
        oneOf: [...unionTypes, ...(isNullable ? [NULL_SCHEMA] : [])],
      }
    }
    case 'intersection':
      return withNullAlternative(
        {
          allOf: type.types.map((t) =>
            resolveTypeToOpenAPI3({ type: t, components, replaceRefs })
          ),
        },
        nullable
      )
    case 'literal':
      return resolveEnumToOpenAPI3([type.value], nullable)
    case 'date':
      return {
        type: 'string',
        format: 'date-time',
        ...(nullable ? { nullable: true } : {}),
      }
    case 'buffer':
      return {
        type: 'string',
        format: 'binary',
        ...(nullable ? { nullable: true } : {}),
      }
    case 'bigint':
      return {
        type: 'string',
        format: 'bigint',
        ...(nullable ? { nullable: true } : {}),
      }
    case 'symbol':
      return {} // ignore
    case 'map':
      return {
        type: 'object',
        additionalProperties: true,
        ...(nullable ? { nullable: true } : {}),
      }
    case 'set':
      return {
        type: 'array',
        items: { type: 'string' },
        ...(nullable ? { nullable: true } : {}),
      }
    case 'regexp':
      return {
        type: 'string',
        format: 'regexp',
        ...(nullable ? { nullable: true } : {}),
      }
    case 'stream':
      return {
        type: 'string',
        format: 'stream',
        ...(nullable ? { nullable: true } : {}),
      }
    case 'enum':
      return resolveEnumToOpenAPI3(type.values, nullable)
    case 'generic':
      return resolveTypeToOpenAPI3({
        type: nullable ? { ...type.structure, nullable } : type.structure,
        components,
        replaceRefs,
      })
    case 'ref': {
      const componentKey = type.schemaName ?? type.name
      return withNullAlternative(
        { $ref: `#/components/schemas/${componentKey}` },
        nullable
      )
    }
    case 'any':
    case 'unknown':
      // any JSON value, including null
      return {}
  }
}

const resolveEnumToOpenAPI3 = (
  values: (string | number | boolean)[],
  nullable: boolean
) => {
  const valuesByType = groupBy(values, (value) =>
    typeof value === 'boolean'
      ? 'boolean'
      : typeof value === 'string'
      ? 'string'
      : 'number'
  )
  const enumSchemas = Object.entries(valuesByType).map(
    ([type, typeValues]) => ({ type, enum: typeValues })
  )

  if (enumSchemas.length === 1) {
    // `nullable` does not override `enum` membership, so null must be listed as well
    return nullable
      ? { ...enumSchemas[0], enum: [...enumSchemas[0].enum, null], nullable }
      : enumSchemas[0]
  }

  return {
    oneOf: [...enumSchemas, ...(nullable ? [NULL_SCHEMA] : [])],
  }
}

// Helper functions remain unchanged
function initializeProgram(modulePath: string, tsConfigPath: string) {
  // read tsconfig
  const tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile)

  if (tsConfig.error || !tsConfig.config) {
    throw new Error(`Could not read tsconfig: ${tsConfigPath}`)
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    tsConfig.config,
    ts.sys,
    path.dirname(tsConfigPath)
  )

  const program = ts.createProgram({
    rootNames: [modulePath],
    options: parsedConfig.options,
  })

  const sourceFile = program.getSourceFile(modulePath)
  if (!sourceFile) {
    throw new Error(`Could not find source file: ${modulePath}`)
  }

  return { program, sourceFile, typeChecker: program.getTypeChecker() }
}

function findDefaultExport(sourceFile: ts.SourceFile) {
  const rootNode = sourceFile.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals
  )

  if (!rootNode) {
    throw new Error('No default export found')
  }

  return rootNode
}

function extractRouteTypes(
  rootNode: ts.ExportAssignment,
  typeChecker: ts.TypeChecker
) {
  const bagType = typeChecker.getTypeAtLocation(rootNode.expression)
  const routesTypeArg = (bagType as ts.TypeReference).typeArguments?.[0]

  if (!routesTypeArg) {
    throw new Error('Could not find routes type argument')
  }

  return routesTypeArg.isUnion() ? routesTypeArg.types : [routesTypeArg]
}

function extractRouteMetadata(
  routeType: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  const pathSymbol = routeType.getProperty('path')
  const pathType =
    pathSymbol && typeChecker.getTypeOfSymbolAtLocation(pathSymbol, rootNode)
  const path = pathType?.isStringLiteral() ? pathType.value : undefined

  const methodSymbol = routeType.getProperty('method')
  const methodType =
    methodSymbol &&
    typeChecker.getTypeOfSymbolAtLocation(methodSymbol, rootNode)
  const method = methodType?.isStringLiteral() ? methodType.value : undefined

  const versionSymbol = routeType.getProperty('version')
  const versionType =
    versionSymbol &&
    typeChecker.getTypeOfSymbolAtLocation(versionSymbol, rootNode)
  const version = versionType?.isStringLiteral() ? versionType.value : undefined

  if (method === undefined) throw new Error('Could not find method')
  if (path === undefined) throw new Error('Could not find path')
  if (version === undefined) throw new Error('Could not find version')

  return { method, path, version }
}

function extractValidatorType(
  routeType: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  const typeArguments = (routeType as ts.TypeReference).typeArguments
  if (!typeArguments || typeArguments.length < 4) return undefined

  const validatorOutputType = typeArguments[3]

  if (validatorOutputType) {
    const outputTypeStr = typeChecker.typeToString(validatorOutputType)
    parserLog('Validator output type: %s', outputTypeStr)

    // Try to find the output property directly
    const outputProperty = validatorOutputType.getProperty('output')
    if (outputProperty) {
      parserLog('Found output property directly')
      return typeChecker.getTypeOfSymbolAtLocation(outputProperty, rootNode)
    }

    const standardProperty = validatorOutputType.getProperty('~standard')
    if (!standardProperty) {
      parserLog('No ~standard property found')
      return undefined
    }

    const standardType = typeChecker.getTypeOfSymbolAtLocation(
      standardProperty,
      rootNode
    )

    const typesProperty = standardType.getProperty('types')
    if (!typesProperty) {
      parserLog('No types property found')
      return undefined
    }

    // `types` is optional for Standard Schema validators, e.g. `{ input, output } | undefined`
    const typesType = typeChecker.getNonNullableType(
      typeChecker.getTypeOfSymbolAtLocation(typesProperty, rootNode)
    )
    const typesOutputProperty = typesType.getProperty('output')
    if (typesOutputProperty) {
      return typeChecker.getTypeOfSymbolAtLocation(
        typesOutputProperty,
        rootNode
      )
    }

    parserLog('Could not extract output type')
    return undefined
  }

  return undefined
}

function extractResponseType(
  routeType: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  const responseSymbol = routeType.getProperty('~responseType')
  return (
    responseSymbol &&
    typeChecker.getTypeOfSymbolAtLocation(responseSymbol, rootNode)
  )
}
