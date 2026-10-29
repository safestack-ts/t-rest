import { z } from 'zod'
import { ze } from './zod-extensions.js'

describe('numberString', () => {
  test('accepts number strings', () => {
    expect(ze.numberString().safeParse('12').success).toBe(true)
    expect(ze.numberString().safeParse('-1.5').success).toBe(true)
  })

  test('rejects empty and non-number strings', () => {
    expect(ze.numberString().safeParse('').success).toBe(false)
    expect(ze.numberString().safeParse('   ').success).toBe(false)
    expect(ze.numberString().safeParse('abc').success).toBe(false)
  })
})

describe('integerString', () => {
  test('accepts integer strings', () => {
    expect(ze.integerString().safeParse('12').success).toBe(true)
    expect(ze.integerString().safeParse('-3').success).toBe(true)
  })

  test('rejects partial and non-integer strings', () => {
    expect(ze.integerString().safeParse('12abc').success).toBe(false)
    expect(ze.integerString().safeParse('1e3').success).toBe(false)
    expect(ze.integerString().safeParse('1.5').success).toBe(false)
    expect(ze.integerString().safeParse('').success).toBe(false)
  })
})

describe('parseInteger', () => {
  test('parses integer strings and numbers', () => {
    expect(ze.parseInteger().parse('12')).toBe(12)
    expect(ze.parseInteger().parse('-7')).toBe(-7)
    expect(ze.parseInteger().parse('+7')).toBe(7)
    expect(ze.parseInteger().parse(42)).toBe(42)
  })

  test('rejects partial integer strings', () => {
    expect(ze.parseInteger().safeParse('12abc').success).toBe(false)
    expect(ze.parseInteger().safeParse('1.5').success).toBe(false)
    expect(ze.parseInteger().safeParse('').success).toBe(false)
  })

  test('rejects exponent notation', () => {
    expect(ze.parseInteger().safeParse('1e3').success).toBe(false)
  })

  test('rejects integers beyond the safe integer range', () => {
    expect(ze.parseInteger().safeParse('9007199254740993').success).toBe(false)
  })
})

describe('parseFloating', () => {
  test('parses floating number strings and numbers', () => {
    expect(ze.parseFloating().parse('3.5')).toBe(3.5)
    expect(ze.parseFloating().parse('-.5')).toBe(-0.5)
    expect(ze.parseFloating().parse('3')).toBe(3)
    expect(ze.parseFloating().parse('1e3')).toBe(1000)
    expect(ze.parseFloating().parse(2.25)).toBe(2.25)
  })

  test('rejects partial and non-number strings', () => {
    expect(ze.parseFloating().safeParse('3abc').success).toBe(false)
    expect(ze.parseFloating().safeParse('abc').success).toBe(false)
    expect(ze.parseFloating().safeParse('').success).toBe(false)
    expect(ze.parseFloating().safeParse('Infinity').success).toBe(false)
  })
})

describe('parseCSVInteger', () => {
  test('parses comma separated integers', () => {
    expect(ze.parseCSVInteger().parse('1,2,3')).toEqual([1, 2, 3])
    expect(ze.parseCSVInteger().parse('1, 2')).toEqual([1, 2])
  })

  test('parses empty string to empty array', () => {
    expect(ze.parseCSVInteger().parse('')).toEqual([])
  })

  test('rejects non-integer values', () => {
    expect(ze.parseCSVInteger().safeParse('a,1').success).toBe(false)
    expect(ze.parseCSVInteger().safeParse('1,2abc').success).toBe(false)
    expect(ze.parseCSVInteger().safeParse('1,,2').success).toBe(false)
    expect(ze.parseCSVInteger().safeParse('1.5').success).toBe(false)
  })
})

describe('uuid', () => {
  test.each([
    ['v1', 'c232ab00-9414-11ec-b3c8-9f6bdeced846'],
    ['v4', '919108f7-52d1-4320-9bac-f847db4148a8'],
    ['v6', '1ec9414c-232a-6b00-b3c8-9f6bdeced846'],
    ['v7', '017f22e2-79b0-7cc3-98c4-dc0c0c07398f'],
    ['v8', '2489e9ad-2ee2-8e00-8ec9-32d5f69181c0'],
    ['nil', '00000000-0000-0000-0000-000000000000'],
    ['max', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
  ])('accepts %s uuid', (_, value) => {
    expect(ze.uuid().safeParse(value).success).toBe(true)
  })

  test('rejects invalid uuids', () => {
    expect(
      ze.uuid().safeParse('919108f7-52d1-0320-9bac-f847db4148a8').success
    ).toBe(false)
    expect(
      ze.uuid().safeParse('919108f7-52d1-4320-cbac-f847db4148a8').success
    ).toBe(false)
    expect(ze.uuid().safeParse('not-a-uuid').success).toBe(false)
  })
})

describe('jsonString', () => {
  const schema = ze.jsonString(z.object({ a: z.number() }))

  test('accepts valid json matching the schema', () => {
    expect(schema.safeParse('{"a":1}').success).toBe(true)
  })

  test('reports a validation issue for invalid json', () => {
    expect(() => schema.safeParse('{bad')).not.toThrow()
    expect(schema.safeParse('{bad').success).toBe(false)
    expect(schema.safeParse('{"a":"1"}').success).toBe(false)
  })
})

describe('jsonObject', () => {
  const schema = ze.jsonObject(z.object({ a: z.number() }))

  test('parses json strings and accepts objects', () => {
    expect(schema.parse('{"a":1}')).toEqual({ a: 1 })
    expect(schema.parse({ a: 1 })).toEqual({ a: 1 })
  })

  test('reports a validation issue for invalid json', () => {
    expect(() => schema.safeParse('{bad')).not.toThrow()
    expect(schema.safeParse('{bad').success).toBe(false)
    expect(schema.safeParse('{"a":"1"}').success).toBe(false)
  })
})

describe('parseJSON', () => {
  test('parses json strings', () => {
    expect(ze.parseJSON().parse('{"a":1}')).toEqual({ a: 1 })
  })

  test('reports a validation issue for invalid json', () => {
    expect(() => ze.parseJSON().safeParse('{bad')).not.toThrow()
    expect(ze.parseJSON().safeParse('{bad').success).toBe(false)
  })
})

describe('parseDatabaseId', () => {
  test('parses positive integers', () => {
    expect(ze.parseDatabaseId().parse('1')).toBe(1)
    expect(ze.parseDatabaseId().parse(42)).toBe(42)
  })

  test('rejects zero and negative ids like databaseId', () => {
    expect(ze.databaseId().safeParse(0).success).toBe(false)
    expect(ze.parseDatabaseId().safeParse('0').success).toBe(false)
    expect(ze.parseDatabaseId().safeParse(0).success).toBe(false)
    expect(ze.parseDatabaseId().safeParse('-1').success).toBe(false)
  })
})
