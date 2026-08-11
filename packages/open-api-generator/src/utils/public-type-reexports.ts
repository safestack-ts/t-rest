import ts from 'typescript'

export type PublicTypeReExport = {
  namespacePath: string
  exportName: string
  qualifiedName: string
}

const TRANSFORMING_UTILITY_TYPES = new Set([
  'Omit',
  'Pick',
  'Partial',
  'Required',
  'Readonly',
  'Extract',
  'Exclude',
  'NonNullable',
  'Record',
  'Awaited',
  'ReturnType',
  'Parameters',
  'ConstructorParameters',
  'InstanceType',
  'ThisParameterType',
  'OmitThisParameter',
  'Uppercase',
  'Lowercase',
  'Capitalize',
  'Uncapitalize',
  'NoInfer',
])

const getTypeReferenceLeafName = (typeName: ts.EntityName) =>
  ts.isIdentifier(typeName) ? typeName.text : typeName.right.text

export const isTransparentTypeAliasDeclaration = (
  declaration: ts.TypeAliasDeclaration
) => {
  const typeNode = declaration.type
  if (!ts.isTypeReferenceNode(typeNode)) {
    return false
  }

  const leafName = getTypeReferenceLeafName(typeNode.typeName)
  return !TRANSFORMING_UTILITY_TYPES.has(leafName)
}

const getSymbolTargetId = (symbol: ts.Symbol | undefined) => {
  const declaration = symbol?.declarations?.at(0)
  if (!symbol || !declaration) {
    return undefined
  }

  return `${declaration.getSourceFile().fileName}#${symbol.escapedName.toString()}`
}

export const resolveUltimateTypeTargetId = (
  type: ts.Type,
  typeChecker: ts.TypeChecker
): string | undefined => {
  let currentType = type
  const seenAliasSymbols = new Set<ts.Symbol>()

  while (
    currentType.aliasSymbol &&
    !seenAliasSymbols.has(currentType.aliasSymbol)
  ) {
    const aliasDeclaration = currentType.aliasSymbol.declarations?.at(0)
    if (
      !aliasDeclaration ||
      !ts.isTypeAliasDeclaration(aliasDeclaration) ||
      !isTransparentTypeAliasDeclaration(aliasDeclaration)
    ) {
      return getSymbolTargetId(currentType.aliasSymbol)
    }

    seenAliasSymbols.add(currentType.aliasSymbol)
    currentType = typeChecker.getTypeFromTypeNode(aliasDeclaration.type)
  }

  if (currentType.aliasSymbol) {
    return getSymbolTargetId(currentType.aliasSymbol)
  }

  const symbol = currentType.getSymbol()
  if (
    symbol &&
    symbol.getName() !== '__type' &&
    symbol.getName() !== '__object'
  ) {
    return getSymbolTargetId(symbol)
  }

  return undefined
}

const collectTransparentReExport = (
  exportSymbol: ts.Symbol,
  sourceFile: ts.SourceFile,
  typeChecker: ts.TypeChecker
): { exportName: string; targetId: string } | undefined => {
  const exportName = exportSymbol.getName()

  if (exportSymbol.flags & ts.SymbolFlags.Alias) {
    const aliasedSymbol = typeChecker.getAliasedSymbol(exportSymbol)
    const aliasedDeclaration = aliasedSymbol.declarations?.at(0)
    if (!aliasedDeclaration) {
      return undefined
    }

    if (
      aliasedDeclaration.getSourceFile().fileName === sourceFile.fileName &&
      aliasedSymbol.getName() === exportName
    ) {
      return undefined
    }

    const targetId = getSymbolTargetId(aliasedSymbol)
    return targetId ? { exportName, targetId } : undefined
  }

  const declaration = exportSymbol.declarations?.at(0)
  if (
    !declaration ||
    !ts.isTypeAliasDeclaration(declaration) ||
    !isTransparentTypeAliasDeclaration(declaration)
  ) {
    return undefined
  }

  const targetId = resolveUltimateTypeTargetId(
    typeChecker.getTypeFromTypeNode(declaration.type),
    typeChecker
  )
  if (!targetId) {
    return undefined
  }

  const selfId = `${sourceFile.fileName}#${exportSymbol.escapedName.toString()}`
  if (targetId === selfId) {
    return undefined
  }

  return { exportName, targetId }
}

export const buildPublicTypeReExportIndex = (
  program: ts.Program,
  typeChecker: ts.TypeChecker,
  exportedModuleNamespacePaths: Map<string, string[]>
) => {
  const reExportsByTarget = new Map<string, PublicTypeReExport[]>()

  const addReExport = (targetId: string, reExport: PublicTypeReExport) => {
    const existing = reExportsByTarget.get(targetId) ?? []
    if (existing.some((entry) => entry.qualifiedName === reExport.qualifiedName)) {
      return
    }
    existing.push(reExport)
    reExportsByTarget.set(targetId, existing)
  }

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) {
      continue
    }

    const namespacePath = exportedModuleNamespacePaths.get(sourceFile.fileName)?.[0]
    if (!namespacePath) {
      continue
    }

    const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile)
    if (!moduleSymbol) {
      continue
    }

    for (const exportSymbol of typeChecker.getExportsOfModule(moduleSymbol)) {
      const transparentReExport = collectTransparentReExport(
        exportSymbol,
        sourceFile,
        typeChecker
      )
      if (!transparentReExport) {
        continue
      }

      addReExport(transparentReExport.targetId, {
        namespacePath,
        exportName: transparentReExport.exportName,
        qualifiedName: `${namespacePath}.${transparentReExport.exportName}`,
      })
    }
  }

  for (const [targetId, reExports] of reExportsByTarget) {
    reExportsByTarget.set(
      targetId,
      [...reExports].sort((left, right) => {
        const segmentDifference =
          right.namespacePath.split('.').length -
          left.namespacePath.split('.').length
        return segmentDifference !== 0
          ? segmentDifference
          : left.qualifiedName.localeCompare(right.qualifiedName)
      })
    )
  }

  return reExportsByTarget
}

export const selectReExportForContext = (
  candidates: PublicTypeReExport[],
  namingContext: string | undefined
): PublicTypeReExport | undefined => {
  if (candidates.length === 0) {
    return undefined
  }

  if (!namingContext) {
    return candidates.length === 1 ? candidates[0] : undefined
  }

  const matching = candidates.filter(
    (candidate) =>
      candidate.namespacePath === namingContext ||
      candidate.namespacePath.startsWith(`${namingContext}.`) ||
      namingContext.startsWith(`${candidate.namespacePath}.`)
  )

  if (matching.length === 0) {
    return undefined
  }

  return matching.sort((left, right) => {
    const segmentDifference =
      right.namespacePath.split('.').length - left.namespacePath.split('.').length
    return segmentDifference !== 0
      ? segmentDifference
      : left.qualifiedName.localeCompare(right.qualifiedName)
  })[0]
}
