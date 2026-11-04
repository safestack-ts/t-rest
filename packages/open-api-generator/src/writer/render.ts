import {
  CAPABILITIES,
  CAPABILITY_DOCS,
  Capabilities,
  TARGETS,
} from './capabilities.js'

const COLUMNS = Object.keys(CAPABILITY_DOCS) as (keyof Capabilities)[]

export const renderTargetsReference = (): string =>
  [
    '# OpenAPI targets',
    '',
    '<!-- Generated from packages/open-api-generator/src/writer/capabilities.ts by its docs test. Do not edit. -->',
    '',
    `One writer emits every target (${TARGETS.join(
      ', '
    )}). The targets differ only in the capabilities below; everything else, such as key order, sorted paths and components, discriminators and parameter encodings, is the same. An approximation is reported as [\`writer/downgrade\`](diagnostics.md#writerdowngrade) with the capability name and a JSON pointer into the document.`,
    '',
    `| Capability | ${TARGETS.join(' | ')} |`,
    `| --- | ${TARGETS.map(() => '---').join(' | ')} |`,
    ...COLUMNS.map(
      (column) =>
        `| [\`${column}\`](#${column.toLowerCase()}) | ${TARGETS.map(
          (target) => `\`${CAPABILITIES[target][column]}\``
        ).join(' | ')} |`
    ),
    ...COLUMNS.flatMap((column) => [
      '',
      `## ${column}`,
      '',
      CAPABILITY_DOCS[column],
    ]),
    '',
    '## Implied bounds',
    '',
    'zod integers carry `minimum` and `maximum` of ±`Number.MAX_SAFE_INTEGER`. The reader drops these bounds (`safe-integer-bounds`), so an integer without bounds in the document is a safe integer when it comes from zod.',
    '',
  ].join('\n')
