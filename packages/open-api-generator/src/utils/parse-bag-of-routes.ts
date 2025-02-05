import { HashMap } from '@t-rest/core'
import ts from 'typescript'

export type RouteTypeInfo = {
  input: Record<string, any> | undefined
  output: Record<string, any> | undefined
}

export const parseBagOfRoutes = (modulePath: string) => {
  const { sourceFile, typeChecker } = initializeProgram(modulePath)
  const rootNode = findDefaultExport(sourceFile)
  const routeTypes = extractRouteTypes(rootNode, typeChecker)

  // [method, path, version]
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
        ? transformTypeToOpenAPI(validatorType, typeChecker, rootNode)
        : undefined,
      output: responseType
        ? transformTypeToOpenAPI(responseType, typeChecker, rootNode)
        : undefined,
    })
  }

  return results
}

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

  if (!method) throw new Error('Could not find method')
  if (!path) throw new Error('Could not find path')
  if (!version) throw new Error('Could not find version')

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

function transformTypeToOpenAPI(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
): any {
  if (!type) return undefined

  if (type.isStringLiteral()) return { type: 'string', enum: [type.value] }
  if (type.isNumberLiteral()) return { type: 'number', enum: [type.value] }
  if (type.isUnion()) return handleUnionType(type, typeChecker, rootNode)
  if (type.isIntersection())
    return handleIntersectionType(type, typeChecker, rootNode)

  const typeAsString = typeChecker.typeToString(type)

  if (isArrayType(type, typeAsString))
    return handleArrayType(type, typeChecker, rootNode)
  if (type.isClassOrInterface())
    return handleClassOrInterfaceType(type, typeChecker, rootNode)

  return handleBasicType(type, typeAsString, typeChecker, rootNode)
}

function handleUnionType(
  type: ts.UnionType,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  const unionTypes = type.types.map((t) =>
    transformTypeToOpenAPI(t, typeChecker, rootNode)
  )
  if (unionTypes.every((t) => t.enum)) {
    return {
      type: unionTypes[0].type,
      enum: unionTypes.flatMap((t) => t.enum),
    }
  }
  return { oneOf: unionTypes }
}

function handleIntersectionType(
  type: ts.IntersectionType,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  return {
    allOf: type.types.map((t) =>
      transformTypeToOpenAPI(t, typeChecker, rootNode)
    ),
  }
}

function isArrayType(type: ts.Type, typeAsString: string) {
  const symbol = type.getSymbol()
  return symbol?.name === 'Array' || typeAsString.endsWith('[]]')
}

function handleArrayType(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  const elementType = (type as ts.TypeReference).typeArguments?.at(0)

  if (!elementType) return undefined

  return {
    type: 'array',
    items: transformTypeToOpenAPI(elementType, typeChecker, rootNode),
  }
}

function handleClassOrInterfaceType(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  const symbol = type.getSymbol()
  if (symbol?.name === 'Date') {
    return { type: 'string', format: 'date-time' }
  }

  return createObjectSchema(type, typeChecker, rootNode)
}

function handleBasicType(
  type: ts.Type,
  typeAsString: string,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  const basicTypes: Record<string, { type: string }> = {
    string: { type: 'string' },
    number: { type: 'number' },
    boolean: { type: 'boolean' },
    null: { type: 'null' },
  }

  return (
    basicTypes[typeAsString] || createObjectSchema(type, typeChecker, rootNode)
  )
}

function createObjectSchema(
  type: ts.Type,
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node
) {
  const properties: Record<string, any> = {}
  const required: string[] = []

  type.getProperties().forEach((prop) => {
    const propType = typeChecker.getTypeOfSymbolAtLocation(prop, rootNode)
    const propSchema = transformTypeToOpenAPI(propType, typeChecker, rootNode)

    if (propSchema) {
      properties[prop.name] = propSchema
      if (!(prop.flags & ts.SymbolFlags.Optional)) {
        required.push(prop.name)
      }
    }
  })

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}
