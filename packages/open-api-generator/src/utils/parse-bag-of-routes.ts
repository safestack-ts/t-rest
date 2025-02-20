import { HashMap } from '@t-rest/core'
import ts from 'typescript'
import { ObjectType, TypeDefinition } from '../schema/type-schema'
import debug from 'debug'

const parserLog = debug('t-rest:open-api-generator:parser')
const typeDiscoveryLog = debug('t-rest:open-api-generator:type-discovery')

export type RouteTypeInfo = {
  input: TypeDefinition | undefined
  output: TypeDefinition | undefined
}

export const parseBagOfRoutes = (modulePath: string) => {
  parserLog('Parsing routes from module: %s', modulePath)

  const { sourceFile, typeChecker } = initializeProgram(modulePath)
  const rootNode = findDefaultExport(sourceFile)
  const routeTypes = extractRouteTypes(rootNode, typeChecker)

  const results = new HashMap<[string, string, string], RouteTypeInfo>((key) =>
    key.join('-')
  )

  for (const routeType of routeTypes) {
    const { method, path, version } = extractRouteMetadata(
      routeType,
      typeChecker,
      rootNode
    )

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
        ? transformTypeToIntermediate(validatorType, typeChecker, rootNode, {
            visitedTypes: new Set(),
          })
        : undefined,
      output: responseType
        ? transformTypeToIntermediate(responseType, typeChecker, rootNode, {
            visitedTypes: new Set(),
          })
        : undefined,
    }

    results.set([method, path, version], inputOutputIntermediate)
  }

  parserLog('Finished parsing %d routes', results.size)

  return results
}

type TraverseMeta = {
  visitedTypes?: Set<string>
}

function transformTypeToIntermediate(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
  metadata: TraverseMeta
): TypeDefinition {
  if (!type) throw new Error('Type is undefined')

  // Get type name and handle generic types
  const symbol = type.getSymbol()
  const typeRef = type as ts.TypeReference
  let typeName = type.aliasSymbol?.escapedName?.toString()

  if (typeRef.aliasTypeArguments?.length) {
    const baseTypeName =
      typeName || symbol?.getName() || typeChecker.typeToString(type)

    // Get the generic type structure
    const properties: Record<string, TypeDefinition> = {}
    const required: string[] = []

    type.getApparentProperties().forEach((prop) => {
      const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)
      properties[prop.name] = transformTypeToIntermediate(
        propType,
        typeChecker,
        rootNode,
        metadata
      )

      if (!(prop.flags & ts.SymbolFlags.Optional)) {
        required.push(prop.name)
      }
    })

    return {
      kind: 'generic',
      name: baseTypeName,
      structure: {
        kind: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    }
  }

  typeName = typeName || typeChecker.typeToString(type)
  typeDiscoveryLog('typeName %s', typeName)
  typeDiscoveryLog('visitedTypes %s', metadata.visitedTypes)

  // Check for recursion
  if (typeName && metadata.visitedTypes?.has(typeName)) {
    return {
      kind: 'ref',
      name: typeName,
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
      kind: 'boolean',
    }
  }

  // Handle unions
  if (type.isUnion()) {
    // Check if this is a boolean represented as true | false
    if (type.types.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)) {
      return {
        kind: 'boolean',
      }
    }

    // Check if this is an enum type by looking at the flags of the type itself
    if (
      type.flags & ts.TypeFlags.Enum ||
      type.flags & ts.TypeFlags.EnumLiteral
    ) {
      const enumMembers = typeChecker.getPropertiesOfType(type)
      const values = enumMembers.map((member) => {
        const memberType = typeChecker.getTypeOfSymbolAtLocation(
          member,
          rootNode
        )
        if (memberType.isStringLiteral()) return memberType.value
        if (memberType.isNumberLiteral()) return memberType.value
        throw new Error('Unsupported enum member type')
      })

      // Get enum name from the type's symbol or parent symbol
      const enumSymbol = type.symbol || type.getSymbol()
      const enumName = enumSymbol?.name || ''

      return {
        kind: 'enum',
        values,
        type: typeof values[0] === 'string' ? 'string' : 'number',
        name: enumName,
      }
    }

    // we want to track named union types to not re-visit them again
    if (typeName) {
      metadata.visitedTypes?.add(typeName)
    }

    return {
      kind: 'union',
      types: type.types.map((t) =>
        transformTypeToIntermediate(t, typeChecker, rootNode, metadata)
      ),
    }
  }

  // Handle intersections
  if (type.isIntersection()) {
    // Filter out 'never' types
    const validTypes = type.types.filter((t) => !(t.flags & ts.TypeFlags.Never))

    // Get all properties from all object types in the intersection
    const properties: Record<string, TypeDefinition> = {}
    const required: string[] = []
    let hasNonObjectType = false

    validTypes.forEach((t) => {
      if (t.isClassOrInterface() || t.flags & ts.TypeFlags.Object) {
        // we want to track named intersection types to not re-visit them again
        // important that we add this first before traversing the properties, because it could be a recursive type
        if (typeName) {
          metadata.visitedTypes?.add(typeName)
        }

        t.getProperties().forEach((prop) => {
          const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)
          properties[prop.name] = transformTypeToIntermediate(
            propType,
            typeChecker,
            rootNode,
            metadata
          )
          if (!(prop.flags & ts.SymbolFlags.Optional)) {
            required.push(prop.name)
          }
        })
      } else {
        hasNonObjectType = true
      }
    })

    // If we only have object types, return merged object
    if (!hasNonObjectType && Object.keys(properties).length > 0) {
      return {
        kind: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
        ...(typeName ? { name: typeName } : {}),
      }
    }

    // Otherwise return intersection type
    return {
      kind: 'intersection',
      types: validTypes.map((t) =>
        transformTypeToIntermediate(t, typeChecker, rootNode, metadata)
      ),
    }
  }

  // Handle arrays
  const typeAsString = typeChecker.typeToString(type)

  if (symbol?.name === 'Array' || typeAsString.endsWith('[]]')) {
    const elementType = (type as ts.TypeReference).typeArguments?.at(0)
    if (!elementType) throw new Error('Array element type not found')
    return {
      kind: 'array',
      items: transformTypeToIntermediate(
        elementType,
        typeChecker,
        rootNode,
        metadata
      ),
    }
  }

  const handleBuiltInTypes = () => {
    const buildInTypeName = symbol?.name ?? symbol?.escapedName?.toString()
    if (buildInTypeName === 'Date') {
      return {
        kind: 'date' as const,
      }
    }
    if (
      buildInTypeName?.endsWith('Buffer') ||
      typeAsString.endsWith('Buffer')
    ) {
      return {
        kind: 'buffer' as const,
      }
    }
    if (buildInTypeName === 'BigInt') {
      return {
        kind: 'bigint' as const,
      }
    }
    if (buildInTypeName === 'Symbol') {
      return {
        kind: 'symbol' as const,
      }
    }
    if (buildInTypeName === 'Map') {
      return {
        kind: 'map' as const,
      }
    }
    if (buildInTypeName === 'Set') {
      return {
        kind: 'set' as const,
      }
    }
    if (buildInTypeName === 'RegExp') {
      return {
        kind: 'regexp' as const,
      }
    }
    if (buildInTypeName === 'Stream') {
      return {
        kind: 'stream' as const,
      }
    }

    return null
  }

  const buildInType = handleBuiltInTypes()
  if (buildInType) {
    return buildInType
  }

  if (type.isClassOrInterface()) {
    const buildInType = handleBuiltInTypes()
    if (buildInType) {
      return buildInType
    }

    return transformObjectToIntermediate(type, typeChecker, rootNode, metadata)
  }

  // Handle objects
  if (type.isClassOrInterface()) {
    const buildInType = handleBuiltInTypes()
    if (buildInType) {
      return buildInType
    }

    const result = transformObjectToIntermediate(
      type,
      typeChecker,
      rootNode,
      metadata
    )

    // Add type information
    if (typeName) {
      result.originalName = typeName
    }

    return result
  }

  // Check for enum type
  if (type.isLiteral() || (symbol && symbol.flags & ts.SymbolFlags.Enum)) {
    const enumType = typeChecker.getTypeAtLocation(
      symbol?.declarations?.[0] ?? rootNode
    )
    const enumMembers = typeChecker.getPropertiesOfType(enumType)
    const values = enumMembers.map((member) => {
      const memberType = typeChecker.getTypeOfSymbolAtLocation(member, rootNode)
      if (memberType.isStringLiteral()) return memberType.value
      if (memberType.isNumberLiteral()) return memberType.value
      throw new Error('Unsupported enum member type')
    })
    return {
      kind: 'enum',
      values,
      type: typeof values[0] === 'string' ? 'string' : 'number',
      name: symbol?.name ?? '',
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
  const required: string[] = []

  const typeName = type.aliasSymbol?.escapedName?.toString()

  // we want to track named object types to not re-visit them again
  if (typeName) {
    metadata.visitedTypes?.add(typeName)
  }

  type.getProperties().forEach((prop) => {
    const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)
    properties[prop.name] = transformTypeToIntermediate(
      propType,
      typeChecker,
      rootNode,
      metadata
    )

    if (!(prop.flags & ts.SymbolFlags.Optional)) {
      required.push(prop.name)
    }
  })

  return {
    kind: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    ...(typeName ? { name: typeName } : {}),
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
  }
}

type ResolveTypeToOpenAPI3Args = {
  type: TypeDefinition
  components: Record<string, any>
  replaceRefs: boolean
}

function resolveTypeToOpenAPI3({
  type,
  components,
  replaceRefs,
}: ResolveTypeToOpenAPI3Args): any {
  switch (type.kind) {
    case 'string':
      return {
        type: 'string',
        ...(type.format ? { format: type.format } : {}),
        ...(type.pattern ? { pattern: type.pattern } : {}),
        ...(type.minLength ? { minLength: type.minLength } : {}),
        ...(type.maxLength ? { maxLength: type.maxLength } : {}),
      }
    case 'number':
      return {
        type: 'number',
        ...(type.format ? { format: type.format } : {}),
        ...(type.minimum ? { minimum: type.minimum } : {}),
        ...(type.maximum ? { maximum: type.maximum } : {}),
        ...(type.multipleOf ? { multipleOf: type.multipleOf } : {}),
      }
    case 'boolean':
      return { type: 'boolean' }
    case 'null':
      return { type: 'null' }
    case 'array':
      return {
        type: 'array',
        items: resolveTypeToOpenAPI3({
          type: type.items,
          components,
          replaceRefs,
        }),
        ...(type.minItems ? { minItems: type.minItems } : {}),
        ...(type.maxItems ? { maxItems: type.maxItems } : {}),
        ...(type.uniqueItems ? { uniqueItems: type.uniqueItems } : {}),
      }
    case 'object': {
      const objectSpec = {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(type.properties).map(([key, value]) => [
            key,
            resolveTypeToOpenAPI3({ type: value, components, replaceRefs }),
          ])
        ),
        ...(type.required ? { required: type.required } : {}),
      }

      if (type.name) {
        components[type.name] = objectSpec

        if (replaceRefs) {
          return {
            $ref: `#/components/schemas/${type.name}`,
          }
        }
      }

      return objectSpec
    }
    case 'union': {
      const unionTypes = type.types.map((t) =>
        resolveTypeToOpenAPI3({ type: t, components, replaceRefs })
      )
      if (unionTypes.every((t) => t.enum)) {
        return {
          type: unionTypes[0].type,
          enum: unionTypes.flatMap((t) => t.enum),
        }
      }
      return { oneOf: unionTypes }
    }
    case 'intersection':
      return {
        allOf: type.types.map((t) =>
          resolveTypeToOpenAPI3({ type: t, components, replaceRefs })
        ),
      }
    case 'literal':
      return {
        type: typeof type.value === 'string' ? 'string' : 'number',
        enum: [type.value],
      }
    case 'date':
      return {
        type: 'string',
        format: 'date-time',
      }
    case 'buffer':
      return {
        type: 'string',
        format: 'binary',
      }
    case 'bigint':
      return {
        type: 'string',
        format: 'bigint',
      }
    case 'symbol':
      return {} // ignore
    case 'map':
      return {
        type: 'object',
        additionalProperties: true,
      }
    case 'set':
      return {
        type: 'array',
        items: { type: 'string' },
      }
    case 'regexp':
      return {
        type: 'string',
        format: 'regexp',
      }
    case 'stream':
      return {
        type: 'string',
        format: 'stream',
      }
    case 'enum':
      return {
        type: type.type,
        enum: type.values,
      }
    case 'generic':
      return resolveTypeToOpenAPI3({
        type: type.structure,
        components,
        replaceRefs,
      })
    case 'ref':
      return {
        $ref: `#/components/schemas/${type.name}`,
      }
    case 'any':
    case 'unknown':
      return { type: 'object' }
  }
}

// Helper functions remain unchanged
function initializeProgram(modulePath: string) {
  const program = ts.createProgram({
    rootNames: [modulePath],
    options: {},
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
  const validatorOutput = routeType.getProperty('~validatorOutputType')
  return (
    validatorOutput &&
    typeChecker.getTypeOfSymbolAtLocation(validatorOutput, rootNode)
  )
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
