import { HashMap } from '@t-rest/core'
import ts from 'typescript'
import { ObjectType, TypeDefinition } from '../schema/type-schema'

export type RouteTypeInfo = {
  input: TypeDefinition | undefined
  output: TypeDefinition | undefined
}

export const parseBagOfRoutes = (modulePath: string) => {
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

    const validatorType = extractValidatorType(routeType, typeChecker, rootNode)
    const responseType = extractResponseType(routeType, typeChecker, rootNode)

    results.set([method, path, version], {
      input: validatorType
        ? transformTypeToIntermediate(validatorType, typeChecker, rootNode)
        : undefined,
      output: responseType
        ? transformTypeToIntermediate(responseType, typeChecker, rootNode)
        : undefined,
    })
  }

  return results
}

function transformTypeToIntermediate(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
): TypeDefinition {
  if (!type) throw new Error('Type is undefined')

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

    return {
      kind: 'union',
      types: type.types.map((t) =>
        transformTypeToIntermediate(t, typeChecker, rootNode)
      ),
    }
  }

  if (type.isIntersection()) {
    return {
      kind: 'intersection',
      types: type.types.map((t) =>
        transformTypeToIntermediate(t, typeChecker, rootNode)
      ),
    }
  }

  const typeAsString = typeChecker.typeToString(type)
  const symbol = type.getSymbol()

  if (symbol?.name === 'Array' || typeAsString.endsWith('[]]')) {
    const elementType = (type as ts.TypeReference).typeArguments?.at(0)
    if (!elementType) throw new Error('Array element type not found')
    return {
      kind: 'array',
      items: transformTypeToIntermediate(elementType, typeChecker, rootNode),
    }
  }

  if (type.isClassOrInterface()) {
    if (symbol?.name === 'Date') {
      return {
        kind: 'date',
      }
    }
    return transformObjectToIntermediate(type, typeChecker, rootNode)
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
    transformObjectToIntermediate(type, typeChecker, rootNode)
  )
}

function transformObjectToIntermediate(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
): ObjectType {
  const properties: Record<string, TypeDefinition> = {}
  const required: string[] = []

  type.getProperties().forEach((prop) => {
    const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)
    properties[prop.name] = transformTypeToIntermediate(
      propType,
      typeChecker,
      rootNode
    )

    if (!(prop.flags & ts.SymbolFlags.Optional)) {
      required.push(prop.name)
    }
  })

  return {
    kind: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

export function transformToOpenAPI3(type: TypeDefinition): any {
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
        items: transformToOpenAPI3(type.items),
        ...(type.minItems ? { minItems: type.minItems } : {}),
        ...(type.maxItems ? { maxItems: type.maxItems } : {}),
        ...(type.uniqueItems ? { uniqueItems: type.uniqueItems } : {}),
      }
    case 'object':
      return {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(type.properties).map(([key, value]) => [
            key,
            transformToOpenAPI3(value),
          ])
        ),
        ...(type.required ? { required: type.required } : {}),
      }
    case 'union': {
      const unionTypes = type.types.map((t) => transformToOpenAPI3(t))
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
        allOf: type.types.map((t) => transformToOpenAPI3(t)),
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
    case 'enum':
      return {
        type: type.type,
        enum: type.values,
      }
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
