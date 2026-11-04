import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import plugin, { requireModelId, type RuleModule } from './index.js'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

// Context members available to oxlint JS plugin rules
const OXLINT_CONTEXT_SURFACE = new Set(['filename', 'cwd', 'options', 'report'])

const restrictContext = (rule: RuleModule): RuleModule => ({
  ...rule,
  create: (context) =>
    rule.create(
      new Proxy(context, {
        get(target, property, receiver) {
          if (!OXLINT_CONTEXT_SURFACE.has(String(property)))
            throw new Error(
              `context.${String(
                property
              )} is not part of the oxlint JS plugin context`
            )
          return Reflect.get(target, property, receiver)
        },
      })
    ),
})

const ZOD = `import { z } from 'zod'\n`
const MODELS = `import { defineModels } from '@t-rest/core/zod'\n`
const MODELS_ROOT = { idFromPath: { root: 'src/models' } }
const CHECKOUT = '/repo/src/models/v2024_01_01/shared/checkout.ts'

const valid = [
  `${ZOD}export const English = z.locales.en()`,
  `${ZOD}export const ErrorMap = z.setErrorMap(() => 'invalid')`,
  `${ZOD}export const Person = z.object({}).meta({ id: 'Person' })`,
  `${ZOD}export const Person = z.object({}).meta({ id: 'Person' }).describe('a').readonly().meta({ description: 'b' })`,
  `${ZOD}export const Person = z.object({}).register(z.globalRegistry, { id: 'Person' })`,
  `${ZOD}const id = 'Person'\nexport const Person = z.object({}).meta({ id })`,
  `${ZOD}export const Person = z.object({}).meta({ ...shared })`,
  `${ZOD}export const Person = z.object({}).meta(shared)`,
  `${ZOD}export const Person = z.coerce.date().meta({ id: 'Day' })`,
  `import * as z from 'zod'\nexport const Person = z.object({}).meta({ id: 'Person' })`,
  `import { object } from 'zod'\nexport const Person = object({}).meta({ id: 'Person' })`,
  `${ZOD}export const Person = (z.object({}) as z.ZodType).meta({ id: 'Person' })`,
  `${ZOD}const Person = z.object({}).meta({ id: 'Person' })\nexport const Admin = Person.extend({}).meta({ id: 'Admin' })`,
  `${ZOD}const Person = z.object({})\nexport const Admin = Person.extend({}).meta({ id: 'Admin' })`,
  `${ZOD}const Person = z.object({})\nexport const Same = Person`,
  `${ZOD}const Base = z.object({}).meta({ id: 'Person' })\nexport const Person = Base.describe('person')`,
  `${ZOD}const Base = z.object({}).meta({ id: 'Person' })\nexport const Person = Base.readonly().meta({ description: 'person' })`,
  `${ZOD}const Base = z.object({}).meta({ id: 'Person' })\nconst Described = Base.describe('a')\nexport const Person = Described.readonly()`,
  `${MODELS}${ZOD}const { Person } = defineModels('Shop', { Person: z.object({}) })\nexport const Described = Person.describe('person')`,
  `${MODELS}${ZOD}export const { Person } = defineModels('Shop', { Person: z.object({}) })`,
  `${MODELS}${ZOD}export const models = defineModels('Shop', { Person: z.object({}) })`,
  `${MODELS}const { Person } = defineModels('Shop', {})\nexport const Admin = Person.extend({}).meta({ id: 'Admin' })`,
  `${ZOD}export const Person = z.object({}).meta({ id: 'Person' })\nconst internal = z.object({})`,
  `${ZOD}export const json = z.toJSONSchema(Person)`,
  `${ZOD}export const parsed = z.string().parse('a')`,
  `${ZOD}export const registry = z.registry()`,
  `${ZOD}export const positive = z.check(() => {})`,
  `import { parse as run } from 'zod'\nexport const value = run(schema, input)`,
  `import { object as makeObject } from 'zod'\nexport const Person = makeObject({}).meta({ id: 'Person' })`,
  `import { check } from 'zod'\nexport const positive = check(() => {})`,
  `${ZOD}export const Person = z.object({}).check(z.refine(() => true)).meta({ id: 'Person' })`,
  `${ZOD}export const Person = z.fromJSONSchema({ type: 'object' }).meta({ id: 'Person' })`,
  `${ZOD}export const name = z.object({}).shape.name`,
  `${ZOD}export const name = Person.shape.name.optional()`,
  `import { z } from 'other'\nexport const Person = z.object({})`,
  `export const Person = z.object({})`,
  `import { Person } from './person.js'\nexport const Admin = Person.extend({})`,
  `export const answer = 42`,
  `export function build() { return 1 }`,
  `${ZOD}export const { a } = pick()`,
  {
    code: `${ZOD}export const Checkout = z.object({}).meta({ id: 'V2024_01_01_Shared_Checkout_Total' })`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
  },
  {
    code: `${MODELS}${ZOD}export const { Total } = defineModels('V2024_01_01.Shared.Checkout', { Total: z.string() })`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
  },
  {
    code: `${ZOD}export const Total = z.string().meta({ id: 'Anything' })`,
    filename: '/repo/src/other/checkout.ts',
    options: [MODELS_ROOT],
  },
  {
    code: `${ZOD}export const Total = z.string().meta({ id })`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
  },
  {
    code: `${ZOD}export const Total = z.string().meta({ id: 'Anything' })`,
    filename: CHECKOUT,
  },
  {
    code: `${ZOD}export const Total = z.string().meta({ id: 'v2024_01_01_shared_checkout' })`,
    filename: 'src/models/v2024_01_01/shared/checkout.ts',
    options: [{ idFromPath: { root: 'src/models', case: 'preserve' } }],
  },
  {
    code: `${ZOD}export const Total = z.string().meta({ id: 'V1_UserProfile_X' })`,
    filename: '/repo/src/models/v1/user-profile/index.ts',
    options: [MODELS_ROOT],
  },
]

const invalid = [
  {
    code: `import { z } from 'zod/mini'\nexport const Person = z.object({})`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `${ZOD}export const Person = z.object({})`,
    errors: [{ messageId: 'missingId', data: { name: 'Person' } }],
  },
  {
    code: `${ZOD}export const Person = z.object({}).describe('a')`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `${ZOD}export const Person = z.object({}).meta({ description: 'a' })`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `${ZOD}export const Person = z.object({}).meta()`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `${ZOD}export const Person = z.object({}).meta({ id: 'Person' }).optional()`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `${ZOD}export const Person = z.object({}).meta({ id: 'Person' }).array()`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `import * as z from 'zod'\nexport const Person = z.string()`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `import { string } from 'zod'\nexport const Name = string().min(1)`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `${ZOD}export const Person = z.object({}).check(z.refine(() => true))`,
    errors: [{ messageId: 'missingId', data: { name: 'Person' } }],
  },
  {
    code: `import { object as makeObject } from 'zod'\nexport const Person = makeObject({})`,
    errors: [{ messageId: 'missingId', data: { name: 'Person' } }],
  },
  {
    code: `import { object as parse } from 'zod'\nexport const Person = parse({})`,
    errors: [{ messageId: 'missingId', data: { name: 'Person' } }],
  },
  {
    code: `${ZOD}export const Person = z.fromJSONSchema({ type: 'object' })`,
    errors: [{ messageId: 'missingId', data: { name: 'Person' } }],
  },
  {
    code: `import { fromJSONSchema } from 'zod'\nexport const Person = fromJSONSchema({ type: 'object' })`,
    errors: [{ messageId: 'missingId', data: { name: 'Person' } }],
  },
  {
    code: `${ZOD}export const Names = z.array(z.string()) as z.ZodType`,
    errors: [{ messageId: 'missingId' }],
  },
  {
    code: `${ZOD}const Person = z.object({})\nexport const People = Person.array()`,
    errors: [{ messageId: 'missingId' }],
  },
  ...[
    'extend',
    'safeExtend',
    'pick',
    'omit',
    'partial',
    'required',
    'merge',
  ].map((method) => ({
    code: `${ZOD}const Person = z.object({})\nexport const Derived = Person.${method}({})`,
    errors: [
      {
        messageId: 'derivedWithoutId',
        data: { name: 'Derived', method },
      },
    ],
  })),
  {
    code: `${ZOD}const Person = z.object({}).meta({ id: 'Person' })\nexport const Admin = Person.extend({}).describe('admin')`,
    errors: [{ messageId: 'derivedWithoutId' }],
  },
  {
    code: `${ZOD}const Base = z.object({}).meta({ id: 'Person' })\nexport const Admin = Base.extend({})`,
    errors: [
      {
        messageId: 'derivedWithoutId',
        data: { name: 'Admin', method: 'extend' },
      },
    ],
  },
  {
    code: `${ZOD}const Base = z.object({}).meta({ id: 'Person' })\nconst Admin = Base.extend({})\nexport const Described = Admin.describe('admin')`,
    errors: [
      {
        messageId: 'derivedWithoutId',
        data: { name: 'Described', method: 'extend' },
      },
    ],
  },
  {
    code: `${ZOD}const Base = z.object({}).meta({ id: 'Person' })\nexport const Maybe = Base.optional()`,
    errors: [{ messageId: 'missingId', data: { name: 'Maybe' } }],
  },
  {
    code: `${MODELS}${ZOD}const { Person } = defineModels('Shop', { Person: z.object({}) })\nexport const People = Person.array()`,
    errors: [{ messageId: 'missingId', data: { name: 'People' } }],
  },
  {
    code: `${ZOD}export const Partial = z.object({}).partial()`,
    errors: [{ messageId: 'derivedWithoutId' }],
  },
  {
    code: `${ZOD}export const Partial = z.object({}).meta({ id: 'P' }).partial()`,
    errors: [{ messageId: 'derivedWithoutId' }],
  },
  {
    code: `${MODELS}const { Person } = defineModels('Shop', {})\nexport const Admin = Person.omit({ a: true })`,
    errors: [{ messageId: 'derivedWithoutId' }],
  },
  {
    code: `${ZOD}export const A = z.string()\nexport const B = z.number().meta({ id: 'B' })\nexport const C = z.boolean()`,
    errors: [
      { messageId: 'missingId', data: { name: 'A' } },
      { messageId: 'missingId', data: { name: 'C' } },
    ],
  },
  {
    code: `${ZOD}export const Total = z.string().meta({ id: 'Checkout_Total' })`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
    errors: [
      {
        messageId: 'idMismatch',
        data: {
          name: 'Total',
          actual: 'Checkout_Total',
          expected: 'V2024_01_01_Shared_Checkout',
        },
      },
    ],
  },
  {
    code: `${ZOD}export const Total = z.string().register(z.globalRegistry, { id: 'Other' })`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
    errors: [{ messageId: 'idMismatch' }],
  },
  {
    code: `${ZOD}export const Total = z.string().check(z.minLength(1)).meta({ id: 'Total' })`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
    errors: [
      {
        messageId: 'idMismatch',
        data: {
          name: 'Total',
          actual: 'Total',
          expected: 'V2024_01_01_Shared_Checkout',
        },
      },
    ],
  },
  {
    code: `${ZOD}export const Total = z.fromJSONSchema({ type: 'string' }).meta({ id: 'Total' })`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
    errors: [
      {
        messageId: 'idMismatch',
        data: {
          name: 'Total',
          actual: 'Total',
          expected: 'V2024_01_01_Shared_Checkout',
        },
      },
    ],
  },
  {
    code: `${ZOD}const Base = z.string().meta({ id: 'Total' })\nexport const Total = Base.describe('total')`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
    errors: [
      {
        messageId: 'idMismatch',
        data: {
          name: 'Total',
          actual: 'Total',
          expected: 'V2024_01_01_Shared_Checkout',
        },
      },
    ],
  },
  {
    code: `${MODELS}${ZOD}export const { Total } = defineModels('Other.Namespace', { Total: z.string() })`,
    filename: CHECKOUT,
    options: [MODELS_ROOT],
    errors: [
      {
        messageId: 'idMismatch',
        data: {
          name: 'defineModels',
          actual: 'Other_Namespace',
          expected: 'V2024_01_01_Shared_Checkout',
        },
      },
    ],
  },
  {
    code: `${ZOD}export const Total = z.string().meta({ id: \`Nope\` })`,
    filename: '/repo/packages/app/src/models/v1/user-profile/index.ts',
    options: [MODELS_ROOT],
    errors: [
      {
        messageId: 'idMismatch',
        data: { name: 'Total', actual: 'Nope', expected: 'V1_UserProfile' },
      },
    ],
  },
  {
    code: `${ZOD}export const Total = z.string().meta({ id: 'Total' })`,
    filename: 'src/models/user-profile.ts',
    options: [{ idFromPath: { root: './src/models/', case: 'preserve' } }],
    errors: [
      {
        messageId: 'idMismatch',
        data: { name: 'Total', actual: 'Total', expected: 'user-profile' },
      },
    ],
  },
]

const parser = {
  languageOptions: {
    parser: tseslint.parser,
    sourceType: 'module' as const,
  },
}

for (const [label, rule] of [
  ['require-model-id', requireModelId],
  [
    'require-model-id on the oxlint context surface',
    restrictContext(requireModelId),
  ],
] as const) {
  new RuleTester({ ...parser }).run(label, rule as never, {
    valid: valid.map((entry) =>
      typeof entry === 'string' ? { code: entry } : entry
    ),
    invalid: invalid as never,
  })
}

describe('plugin shape', () => {
  it('names the plugin t-rest and exposes the rule', () => {
    expect(plugin.meta.name).toBe('t-rest')
    expect(Object.keys(plugin.rules)).toEqual(['require-model-id'])
    expect(plugin.rules['require-model-id']).toBe(requireModelId)
  })

  it('declares an ESLint rule module', () => {
    expect(requireModelId.meta.type).toBe('problem')
    expect(Object.keys(requireModelId.meta.messages).sort()).toEqual([
      'derivedWithoutId',
      'idMismatch',
      'missingId',
    ])
    expect(typeof requireModelId.create).toBe('function')
  })
})

describe('context surface test', () => {
  it('fails on members outside the oxlint context', () => {
    const rule = restrictContext({
      ...requireModelId,
      create: (context) => {
        void (context as unknown as { getScope: unknown }).getScope
        return {}
      },
    })
    expect(() =>
      rule.create({ filename: 'a.ts', cwd: '/', options: [], report: () => {} })
    ).toThrow('context.getScope is not part of the oxlint JS plugin context')
  })
})
