import { describe, expect, test } from 'vitest'
import { pipeline } from '../spec/testing.js'
import { CAPABILITIES, Target, TARGETS } from './capabilities.js'
import { writeDocument } from './document.js'
import { instanceValidator } from './testing.js'
import { Owner, varietyBag, varietyOptions } from './variety.js'

// The emitted schemas accept and reject what the zod schemas do, except where
// a capability approximates them.

const ownerValidator = (target: Target) => {
  const { document } = writeDocument(
    pipeline(varietyBag).spec().model,
    target,
    varietyOptions
  )
  return instanceValidator(document, target, {
    $ref: '#/components/schemas/Owner',
  })
}

const owner = {
  name: 'Ada',
  nickname: null,
  status: null,
  pet: { type: 'cat', lives: 9 },
  favorite: { type: 'cat', lives: 1 },
  position: ['home', 1],
  score: 100,
  level: 3,
  code: 1,
  labels: { home: 'a' },
  photo: 'aGk=',
  note: 'short',
  shape: { kind: 'circle', radius: 1 },
}

describe.each(TARGETS)('OpenAPI %s', (target) => {
  const validate = ownerValidator(target)
  const { tuple, propertyNames } = CAPABILITIES[target]

  test.each([
    ['a complete owner', owner],
    ['a nullable string', { ...owner, nickname: 'A' }],
    ['a nullable enum ref', { ...owner, status: 'active' }],
    ['a nullable union', { ...owner, pet: null }],
    ['the other union member', { ...owner, pet: { type: 'dog', good: true } }],
  ])('accepts %s', (_, value) => {
    expect(Owner.safeParse(value).success).toBe(true)
    expect(validate(value), JSON.stringify(validate.errors)).toBe(true)
  })

  test.each([
    ['an unknown enum value', { ...owner, status: 'deleted' }],
    ['the exclusive bound', { ...owner, score: 0 }],
    ['a value above the maximum', { ...owner, score: 101 }],
    ['another literal', { ...owner, level: 4 }],
    ['a literal of neither type', { ...owner, code: 'b' }],
    ['a member out of range', { ...owner, pet: { type: 'cat', lives: 10 } }],
    ['an unknown member', { ...owner, pet: { type: 'bird' } }],
    ['a missing required field', { ...owner, name: undefined }],
    ['a value for never', { ...owner, gone: 1 }],
  ])('rejects %s', (_, value) => {
    const json = JSON.parse(JSON.stringify(value))
    expect(Owner.safeParse(json).success).toBe(false)
    expect(validate(json)).toBe(false)
  })

  test('tuple positions hold only where the target keeps them', () => {
    expect(Owner.safeParse({ ...owner, position: [1, 'home'] }).success).toBe(
      false
    )
    expect(validate({ ...owner, position: [1, 'home'] })).toBe(
      tuple === 'items-any-of'
    )
  })

  test('key patterns hold only where the target keeps them', () => {
    expect(Owner.safeParse({ ...owner, labels: { Home: 'a' } }).success).toBe(
      false
    )
    expect(validate({ ...owner, labels: { Home: 'a' } })).toBe(
      propertyNames === 'dropped'
    )
  })
})
