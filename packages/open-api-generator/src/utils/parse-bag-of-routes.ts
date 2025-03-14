import { HashMap, normalizePathPattern } from '@t-rest/core'
import ts from 'typescript'
import { ObjectType, TypeDefinition } from '../schema/type-schema'
import debug from 'debug'
import path from 'path'

const parserLog = debug('t-rest:open-api-generator:parser')
const typeDiscoveryLog = debug('t-rest:open-api-generator:type-discovery')

export type RouteTypeInfo = {
  input: TypeDefinition | undefined
  output: TypeDefinition | undefined
  routeMeta: {
    originalPath: string
  }
}

export const parseBagOfRoutes = (modulePath: string, tsConfigPath: string) => {
  parserLog('Parsing routes from module: %s', modulePath)

  const { sourceFile, typeChecker } = initializeProgram(
    modulePath,
    tsConfigPath
  )
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

    if (baseTypeName === 'Record') {
      const stringIndexType = typeChecker.getIndexInfoOfType(
        type,
        ts.IndexKind.String
      )
      if (stringIndexType && stringIndexType.type) {
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

    // Check if this is a nullable type (T | null)
    const nullTypes = type.types.filter(
      (t) =>
        (t.flags & ts.TypeFlags.Null) !== 0 ||
        (t.flags & ts.TypeFlags.Undefined) !== 0
    )
    const nonNullTypes = type.types.filter(
      (t) =>
        (t.flags & ts.TypeFlags.Null) === 0 &&
        (t.flags & ts.TypeFlags.Undefined) === 0
    )

    // If we have exactly one non-null type and at least one null/undefined type, this is a nullable type
    if (nonNullTypes.length === 1 && nullTypes.length > 0) {
      return transformTypeToIntermediate(
        nonNullTypes[0],
        typeChecker,
        rootNode,
        metadata
      )
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
    if (
      typeName &&
      type.types.some((t) => t.flags & ts.TypeFlags.NonPrimitive)
    ) {
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
    // Filter out 'never' types and BRAND types
    const validTypes = type.types.filter((t) => {
      const typeName = t.aliasSymbol?.escapedName?.toString()
      return !(t.flags & ts.TypeFlags.Never) && typeName !== 'BRAND' // zod branded types should be ignored
    })

    // Get all properties from all object types in the intersection
    const properties: Record<string, TypeDefinition> = {}
    const required = new Set<string>()
    let hasNonObjectType = false

    // we want to track named intersection types to not re-visit them again
    // important that we add this first before traversing the properties, because it could be a recursive type
    typeName = type.aliasSymbol?.escapedName?.toString()
    if (type.aliasSymbol && typeName) {
      metadata.visitedTypes?.add(typeName)
    }

    validTypes.forEach((t) => {
      if (t.isClassOrInterface() || t.flags & ts.TypeFlags.Object) {
        t.getProperties().forEach((prop) => {
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
      } else {
        hasNonObjectType = true
      }
    })

    // If we only have object types, return merged object
    if (!hasNonObjectType && Object.keys(properties).length > 0) {
      return {
        kind: 'object',
        properties,
        ...(required.size > 0 ? { required: Array.from(required) } : {}),
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

  if (
    symbol?.name === 'Array' ||
    typeAsString.endsWith('[]]') ||
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

    // we want to track named object types to not re-visit them again
    const isFirstVisit = !metadata.visitedTypes?.has(typeName)
    if (typeName) {
      metadata.visitedTypes?.add(typeName)
    }

    const objectSchema = transformObjectToIntermediate(
      type,
      typeChecker,
      rootNode,
      metadata
    )

    return {
      ...objectSchema,
      ...(isFirstVisit ? { name: typeName } : {}),
    }
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
  const required = new Set<string>()

  const typeName = type.aliasSymbol?.escapedName?.toString()

  // we want to track named object types to not re-visit them again
  if (typeName) {
    metadata.visitedTypes?.add(typeName)
  }

  type.getProperties().forEach((prop) => {
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

  return {
    kind: 'object',
    properties,
    ...(required.size > 0 ? { required: Array.from(required) } : {}),
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
      return { nullable: true }
    case 'array':
      return {
        type: 'array',
        items: type.items
          ? resolveTypeToOpenAPI3({
              type: type.items,
              components,
              replaceRefs,
            })
          : undefined,
        ...(type.minItems !== undefined ? { minItems: type.minItems } : {}),
        ...(type.maxItems !== undefined ? { maxItems: type.maxItems } : {}),
        ...(type.uniqueItems !== undefined
          ? { uniqueItems: type.uniqueItems }
          : {}),
        ...(nullable ? { nullable: true } : {}),
      }
    case 'tuple': {
      return {
        type: 'array',
        items: type.elementTypes.map((t) =>
          resolveTypeToOpenAPI3({ type: t, components, replaceRefs })
        ),
        minItems: type.elementTypes.length,
        maxItems: type.elementTypes.length,
        ...(nullable ? { nullable: true } : {}),
      }
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
        ...(nullable ? { nullable: true } : {}),
      }

      if (type.name) {
        components[type.name] = objectSpec

        if (replaceRefs) {
          return {
            $ref: `#/components/schemas/${type.name}`,
            ...(nullable ? { nullable: true } : {}),
          }
        }
      }

      return objectSpec
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
      const unionTypes = type.types.map((t) =>
        resolveTypeToOpenAPI3({ type: t, components, replaceRefs })
      )
      if (unionTypes.every((t) => t.enum)) {
        return {
          type: unionTypes[0].type,
          enum: unionTypes.flatMap((t) => t.enum),
          ...(nullable ? { nullable: true } : {}),
        }
      }
      return {
        oneOf: unionTypes,
        ...(nullable ? { nullable: true } : {}),
      }
    }
    case 'intersection':
      return {
        allOf: type.types.map((t) =>
          resolveTypeToOpenAPI3({ type: t, components, replaceRefs })
        ),
        ...(nullable ? { nullable: true } : {}),
      }
    case 'literal':
      return {
        type: typeof type.value === 'string' ? 'string' : 'number',
        enum: [type.value],
        ...(nullable ? { nullable: true } : {}),
      }
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
      return {
        type: type.type,
        enum: type.values,
        ...(nullable ? { nullable: true } : {}),
      }
    case 'generic':
      return {
        ...resolveTypeToOpenAPI3({
          type: type.structure,
          components,
          replaceRefs,
        }),
        ...(nullable ? { nullable: true } : {}),
      }
    case 'ref':
      return {
        $ref: `#/components/schemas/${type.name}`,
        ...(nullable ? { nullable: true } : {}),
      }
    case 'any':
    case 'unknown':
      return {
        type: 'object',
        ...(nullable ? { nullable: true } : {}),
      }
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

    const typesType = typeChecker.getTypeOfSymbolAtLocation(
      typesProperty,
      rootNode
    )

    // Check if typesType is a union type
    if (typesType.isUnion()) {
      parserLog('Found union type with', typesType.types.length, 'types')

      // In a union type, the second element is typically the output
      if (typesType.types.length >= 2) {
        // Get the second type from the union (index 1)
        const outputType = typesType.types[1]

        // Check if this is a tuple type that contains both input and output
        if (outputType.flags & ts.TypeFlags.Object) {
          const outputObjectType = outputType as ts.ObjectType

          // If it's a tuple, we need to extract just the output part
          if (outputObjectType.objectFlags & ts.ObjectFlags.Tuple) {
            parserLog('Second union element is a tuple, extracting output')
            const outputTupleType = outputObjectType as ts.TupleType
            if (
              outputTupleType.typeArguments &&
              outputTupleType.typeArguments.length > 0
            ) {
              // For output, we want just the first element of this tuple
              return outputTupleType.typeArguments[0]
            }
          }

          // If it has an 'output' property, extract that
          const outputProp = outputType.getProperty('output')
          if (outputProp) {
            parserLog('Found output property on second union element')
            return typeChecker.getTypeOfSymbolAtLocation(outputProp, rootNode)
          }
        }

        // If we couldn't extract a specific output part, return the whole second element
        parserLog('Returning second union element as output type')
        return outputType
      }
    }

    // Try to access the output type through type arguments if it's a type reference
    const typeRef = typesType as ts.TypeReference
    if (typeRef.typeArguments && typeRef.typeArguments.length > 1) {
      parserLog('Found output type through type arguments')
      return typeRef.typeArguments[1]
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
