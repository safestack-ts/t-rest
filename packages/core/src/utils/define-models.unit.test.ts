import { expect, test } from 'vitest'
import { z } from 'zod'
import { defineModels } from './define-models.js'

const jsonSchemaOf = (schema: z.ZodType) =>
  schema['~standard'].jsonSchema.output({ target: 'draft-2020-12' })

test('gives every model the id of its namespace and key', () => {
  const Person = z.object({ name: z.string() })
  const Address = z.object({ street: z.string() })

  const models = defineModels('V2024_01_01.Shared.Checkout', {
    Person,
    Address,
  })

  expect(models.Person).toBe(Person)
  expect(models.Address).toBe(Address)
  expect(z.globalRegistry.get(Person)?.id).toBe(
    'V2024_01_01_Shared_Checkout_Person'
  )
  expect(jsonSchemaOf(Address)).toEqual({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $ref: '#/$defs/V2024_01_01_Shared_Checkout_Address',
    $defs: {
      V2024_01_01_Shared_Checkout_Address: {
        type: 'object',
        properties: { street: { type: 'string' } },
        required: ['street'],
        additionalProperties: false,
      },
    },
  })
})

test('keeps the existing meta data of a model', () => {
  const { Person } = defineModels('Described', {
    Person: z.object({ name: z.string() }).describe('A person'),
  })

  expect(z.globalRegistry.get(Person)).toEqual({
    description: 'A person',
    id: 'Described_Person',
  })
})

test('schemas defined before the call reference the model', () => {
  const Person = z.object({ name: z.string() })
  const Team = z.object({ lead: Person })

  defineModels('Earlier', { Person })

  expect(jsonSchemaOf(Team)).toMatchObject({
    properties: { lead: { $ref: '#/$defs/Earlier_Person' } },
    $defs: { Earlier_Person: { type: 'object' } },
  })
})

test('a model with another id becomes an alias of it', () => {
  const { Person } = defineModels('Shared', {
    Person: z.object({ name: z.string() }),
  })

  const { Person: AdminPerson } = defineModels('Admin', { Person })

  expect(AdminPerson).not.toBe(Person)
  expect(z.globalRegistry.get(Person)?.id).toBe('Shared_Person')
  expect(jsonSchemaOf(AdminPerson)).toMatchObject({
    $ref: '#/$defs/Admin_Person',
    $defs: {
      Admin_Person: { $ref: '#/$defs/Shared_Person' },
      Shared_Person: { type: 'object' },
    },
  })
})

test('a model with an id from .meta() becomes an alias of it', () => {
  const Failure = z.object({ error: z.string() }).meta({ id: 'Failure' })

  const { Error } = defineModels('Api', { Error: Failure })

  expect(jsonSchemaOf(Error)).toMatchObject({
    $defs: { Api_Error: { $ref: '#/$defs/Failure' } },
  })
})

test('defining a model twice with the same id keeps the model', () => {
  const { Person } = defineModels('Twice', {
    Person: z.object({ name: z.string() }),
  })

  expect(defineModels('Twice', { Person }).Person).toBe(Person)
})

test('rejects ids that are not alphanumeric with underscores', () => {
  expect(() =>
    defineModels('Shared-Checkout', { Person: z.object({}) })
  ).toThrow('Shared-Checkout_Person')
})

test('an invalid id registers none of the models', () => {
  const First = z.object({})
  const Second = z.object({})

  expect(() =>
    defineModels('Partial', { First, Second, 'Third-Model': z.object({}) })
  ).toThrow('Partial_Third-Model')
  expect(z.globalRegistry.get(First)).toBeUndefined()
  expect(z.globalRegistry.get(Second)).toBeUndefined()
})

test('a module evaluated again registers its new schemas under the same ids', () => {
  defineModels('Reloaded', { Person: z.object({ name: z.string() }) })

  const { Person } = defineModels('Reloaded', {
    Person: z.object({ name: z.string(), age: z.number() }),
  })

  expect(z.globalRegistry.get(Person)?.id).toBe('Reloaded_Person')
})
