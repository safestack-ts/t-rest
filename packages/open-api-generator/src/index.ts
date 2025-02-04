import ts from 'typescript'

interface RouteTypeInfo {
  input: ts.TypeNode | undefined
  output: ts.TypeNode | undefined
}

function analyzeRouteTypes(filePath: string) {
  // Create program with target file
  const program = ts.createProgram({
    rootNames: [filePath],
    options: {},
  })

  const sourceFile = program.getSourceFile(filePath)
  if (!sourceFile) {
    throw new Error(`Could not find source file: ${filePath}`)
  }

  const typeChecker = program.getTypeChecker()
  const results: Record<string, RouteTypeInfo> = {}

  // Find the default export which should be the bag of routes
  const defaultExport = sourceFile.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals
  )

  if (!defaultExport) {
    throw new Error('No default export found')
  }

  // Get the type of the bag of routes
  const bagType = typeChecker.getTypeAtLocation(defaultExport.expression)

  // Get the first generic type argument (_TRoutes)
  const routesTypeArg = (bagType as ts.TypeReference).typeArguments?.[0]
  if (!routesTypeArg) {
    throw new Error('Could not find routes type argument')
  }

  // If it's a union type, get all the union members
  const routeTypes = routesTypeArg.isUnion()
    ? routesTypeArg.types
    : [routesTypeArg]

  // Analyze each route definition in the union
  for (const routeType of routeTypes) {
    const validatorOutput = routeType.getProperty('~validatorOutputType')
    const validatorType =
      validatorOutput &&
      typeChecker.getTypeOfSymbolAtLocation(validatorOutput, defaultExport)

    const responseSymbol = routeType.getProperty('~responseType')
    const responseType =
      responseSymbol &&
      typeChecker.getTypeOfSymbolAtLocation(responseSymbol, defaultExport)

    const pathSymbol = routeType.getProperty('path')
    const pathType =
      pathSymbol &&
      typeChecker.getTypeOfSymbolAtLocation(pathSymbol, defaultExport)
    const path = pathType?.isStringLiteral() ? pathType.value : undefined

    if (path) {
      const transformTypeToOpenAPI = (type: ts.Type | undefined): any => {
        if (!type) return undefined

        const typeAsString = typeChecker.typeToString(type)

        if (type.isStringLiteral()) {
          return { type: 'string', enum: [type.value] }
        }

        if (type.isNumberLiteral()) {
          return { type: 'number', enum: [type.value] }
        }

        if (type.isUnion()) {
          const unionTypes = type.types.map((t) => transformTypeToOpenAPI(t))
          if (unionTypes.every((t) => t.enum)) {
            return {
              type: unionTypes[0].type,
              enum: unionTypes.flatMap((t) => t.enum),
            }
          }
          return { oneOf: unionTypes }
        }

        if (type.isIntersection()) {
          return {
            allOf: type.types.map((t) => transformTypeToOpenAPI(t)),
          }
        }

        const symbol = type.getSymbol()
        if (symbol?.name === 'Array' || typeAsString.endsWith('[]]')) {
          const elementType = (type as ts.TypeReference).typeArguments?.[0]
          return {
            type: 'array',
            items: transformTypeToOpenAPI(elementType),
          }
        }

        if (type.isClassOrInterface()) {
          // Check if it's a Date type
          const symbol = type.getSymbol()
          if (symbol?.name === 'Date') {
            return { type: 'string', format: 'date-time' }
          }

          const properties: Record<string, any> = {}
          const required: string[] = []

          type.getProperties().forEach((prop) => {
            const propType = typeChecker.getTypeOfSymbolAtLocation(
              prop,
              defaultExport
            )
            const propSchema = transformTypeToOpenAPI(propType)
            if (propSchema) {
              properties[prop.name] = propSchema
              const propSymbol = type.getProperty(prop.name)
              if (propSymbol && !(propSymbol.flags & ts.SymbolFlags.Optional)) {
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

        switch (typeAsString) {
          case 'string':
            return { type: 'string' }
          case 'number':
            return { type: 'number' }
          case 'boolean':
            return { type: 'boolean' }
          case 'null':
            return { type: 'null' }
          default: {
            // For complex types, we should already have the TypeScript type information
            // through the type checker, so we can examine the structure directly
            const properties: Record<string, any> = {}
            const required: string[] = []

            type.getProperties().forEach((prop) => {
              const propType = typeChecker.getTypeOfSymbolAtLocation(
                prop,
                defaultExport
              )
              const propSchema = transformTypeToOpenAPI(propType)
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
        }
      }

      results[path] = {
        input: validatorType
          ? transformTypeToOpenAPI(validatorType)
          : undefined,
        output: responseType ? transformTypeToOpenAPI(responseType) : undefined,
      }
    }
  }

  return results
}

const routeTypes = analyzeRouteTypes('./src/bag.ts')

console.log(JSON.stringify(routeTypes, null, 2))
