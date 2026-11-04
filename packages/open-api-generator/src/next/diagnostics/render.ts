import { DIAGNOSTICS, DiagnosticCode, diagnosticAnchor } from './registry.js'

export const renderDiagnosticsReference = (): string => {
  const codes = Object.keys(DIAGNOSTICS).sort() as DiagnosticCode[]

  return [
    '# Generator diagnostics',
    '',
    '<!-- Generated from packages/open-api-generator/src/next/diagnostics/registry.ts by its docs test. Do not edit. -->',
    '',
    'Every diagnostic has a code, a severity and a location (operation, slot, JSON pointer). `write()` writes nothing when any diagnostic is an error. Codes marked configurable accept a severity override in `config.diagnostics`.',
    '',
    '| Code | Severity | Configurable |',
    '| --- | --- | --- |',
    ...codes.map(
      (code) =>
        `| [\`${code}\`](#${diagnosticAnchor(code)}) | ${
          DIAGNOSTICS[code].severity
        } | ${DIAGNOSTICS[code].configurable ? 'yes' : 'no'} |`
    ),
    ...codes.flatMap((code) => {
      const { title, trigger, fix } = DIAGNOSTICS[code]
      return [
        '',
        `## ${code}`,
        '',
        `**${title}.**`,
        '',
        trigger,
        '',
        `**Fix.** ${fix}`,
      ]
    }),
    '',
  ].join('\n')
}
