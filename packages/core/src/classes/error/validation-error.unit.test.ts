import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { ValidationError } from './validation-error.js'

const getIssues = () => {
  const result = z.object({ id: z.number() }).safeParse({ id: 'a' })

  if (result.success) throw new Error('expected validation to fail')

  return result.error.issues
}

// loads a second, independent copy of the module, like the ESM and the CJS
// build of @t-rest/core being loaded side by side
const importOtherModuleCopy = async () => {
  vi.resetModules()
  const module = await import('./validation-error.js')

  return module.ValidationError
}

describe('ValidationError', () => {
  test('keeps the issues and joins their messages as message', () => {
    const issues = getIssues()
    const error = new ValidationError(issues)

    expect(error.issues).toEqual(issues)
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe(issues.map((issue) => issue.message).join('\n'))
    expect(error.toString()).toBe(error.message)
    expect(error).toBeInstanceOf(Error)
  })

  test('is recognized by isValidationError and instanceof', () => {
    const error = new ValidationError(getIssues())

    expect(ValidationError.isValidationError(error)).toBe(true)
    expect(error instanceof ValidationError).toBe(true)
  })

  test('other errors are not recognized', () => {
    const lookalike = Object.assign(new Error('nope'), {
      name: 'ValidationError',
      issues: [],
    })

    for (const value of [lookalike, new Error('x'), null, undefined, 'x', {}]) {
      expect(ValidationError.isValidationError(value)).toBe(false)
      expect(value instanceof ValidationError).toBe(false)
    }
  })

  test('errors of another module copy are recognized', async () => {
    const OtherValidationError = await importOtherModuleCopy()

    expect(OtherValidationError).not.toBe(ValidationError)

    const foreignError = new OtherValidationError(getIssues())

    expect(foreignError instanceof ValidationError).toBe(true)
    expect(ValidationError.isValidationError(foreignError)).toBe(true)
    expect(
      new ValidationError(getIssues()) instanceof OtherValidationError
    ).toBe(true)
  })

  test('subclasses keep the prototype chain check', () => {
    class CustomValidationError extends ValidationError {}

    const custom = new CustomValidationError(getIssues())

    expect(custom instanceof ValidationError).toBe(true)
    expect(
      new ValidationError(getIssues()) instanceof CustomValidationError
    ).toBe(false)
  })
})
