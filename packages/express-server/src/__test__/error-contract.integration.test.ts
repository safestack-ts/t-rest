import { createRequire } from 'node:module'
import { describe, expect, test, vi } from 'vitest'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import {
  BagOfRoutes,
  Route,
  ValidationError,
  VersionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { VersionResolutionError } from '../classes/version-resolution-error.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'

// consumers loading the CJS build next to the ESM build get a second copy of
// the error classes, the errors must be recognized by both copies
const require = createRequire(__filename)
const { ValidationError: CJSValidationError } =
  require('@t-rest/core') as typeof import('@t-rest/core')

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

// records the error reaching the error handler, like a consumer error handler
// classifying errors into responses
const initApplication = (
  versions: string[] = [...versionHistory],
  extractor = new APIVersionHeaderExtractor()
) => {
  const errors: unknown[] = []
  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-02-01')
        .post('/users/:userId')
        .validate(
          z.object({
            params: z.strictObject({ userId: ze.parseInteger() }),
            body: z.strictObject({ email: z.email() }),
          })
        )
        .response<{ userId: number }>()
    )
    .build()

  const expressApp = Express()
  expressApp.use(Express.json())

  const app = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versions as typeof versionHistory,
    extractor
  )

  app
    .post('/users/:userId')
    .version('2024-02-01')
    .handle((_, { params }, response) => {
      response.status(StatusCodes.OK).json(params)
    })

  expressApp.use(
    (
      error: unknown,
      _req: ExpressRequest,
      res: ExpressResponse,
      _next: ExpressNextFunction
    ) => {
      errors.push(error)

      if (ValidationError.isValidationError(error)) {
        res.status(StatusCodes.BAD_REQUEST).json({ issues: error.issues })
      } else if (VersionResolutionError.isVersionResolutionError(error)) {
        res.status(StatusCodes.NOT_FOUND).json({ message: error.message })
      } else {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({})
      }
    }
  )

  return { expressApp, errors }
}

describe('validation errors', () => {
  test('invalid input reaches the error handler as ValidationError with issues', async () => {
    const { expressApp, errors } = initApplication()

    const response = await request(expressApp)
      .post('/users/abc')
      .set('x-api-version', '2024-02-01')
      .send({ email: 'not-an-email' })
      .expect(StatusCodes.BAD_REQUEST)

    expect(errors).toHaveLength(1)
    const [error] = errors

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toBeInstanceOf(CJSValidationError)
    expect(CJSValidationError.isValidationError(error)).toBe(true)
    expect((error as Error).name).toBe('ValidationError')

    const issuePaths = (error as ValidationError).issues.map((issue) =>
      issue.path?.map((segment) =>
        typeof segment === 'object' ? segment.key : segment
      )
    )
    expect(issuePaths).toEqual(
      expect.arrayContaining([
        ['params', 'userId'],
        ['body', 'email'],
      ])
    )
    expect(response.body.issues).toHaveLength(issuePaths.length)
  })

  test('unknown keys of strict objects are reported', async () => {
    const { expressApp, errors } = initApplication()

    await request(expressApp)
      .post('/users/1')
      .set('x-api-version', '2024-02-01')
      .send({ email: 'jon@doe.com', role: 'admin' })
      .expect(StatusCodes.BAD_REQUEST)

    expect((errors[0] as ValidationError).issues).toEqual([
      expect.objectContaining({ code: 'unrecognized_keys', keys: ['role'] }),
    ])
  })

  test('the handler is not called for invalid input', async () => {
    const { expressApp } = initApplication()

    const response = await request(expressApp)
      .post('/users/1')
      .set('x-api-version', '2024-02-01')
      .send({})
      .expect(StatusCodes.BAD_REQUEST)

    expect(response.body).not.toHaveProperty('userId')
  })
})

describe('version resolution errors', () => {
  const expectVersionResolutionError = async (
    expressApp: Express.Express,
    errors: unknown[],
    version: string | undefined,
    message: string
  ) => {
    const pendingRequest = request(expressApp).post('/users/1')

    if (version !== undefined) {
      pendingRequest.set('x-api-version', version)
    }

    const response = await pendingRequest
      .send({ email: 'jon@doe.com' })
      .expect(StatusCodes.NOT_FOUND)

    expect(errors).toHaveLength(1)
    const [error] = errors

    expect(error).toBeInstanceOf(VersionResolutionError)
    expect(error).toMatchObject({
      name: 'VersionResolutionError',
      status: 400,
      statusCode: 400,
      message,
    })
    expect(response.body).toEqual({ message })
  }

  // consumers classify these errors by their message, so the messages are
  // part of the contract
  test('a version older than any route version', async () => {
    const { expressApp, errors } = initApplication()

    await expectVersionResolutionError(
      expressApp,
      errors,
      '2024-01-01',
      'No compatible route version found for requested version 2024-01-01'
    )
  })

  test('an invalid date version', async () => {
    const { expressApp, errors } = initApplication()

    await expectVersionResolutionError(
      expressApp,
      errors,
      'not-a-date',
      'No compatible route version found for requested version not-a-date'
    )
  })

  test('no version and no version history to default to', async () => {
    const { expressApp, errors } = initApplication([])

    await expectVersionResolutionError(
      expressApp,
      errors,
      undefined,
      'No version specified and no default version found'
    )
  })

  test('a missing version falls back to the latest version', async () => {
    const { expressApp, errors } = initApplication()

    await request(expressApp)
      .post('/users/1')
      .send({ email: 'jon@doe.com' })
      .expect(StatusCodes.OK, { userId: 1 })

    expect(errors).toEqual([])
  })

  test("express' default error handler responds with bad request", async () => {
    const bagOfRoutes = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    )
      .addRoute(Route.version('2024-02-01').get('/users').response<string>())
      .build()
    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor()
    )
    app
      .get('/users')
      .version('2024-02-01')
      .handle((_, __, response) => {
        response.json('users')
      })

    await request(expressApp)
      .get('/users')
      .set('x-api-version', '2024-01-01')
      .expect(StatusCodes.BAD_REQUEST)
  })
})

describe('VersionResolutionError identity', () => {
  test('errors of another module copy are recognized', async () => {
    vi.resetModules()
    const { VersionResolutionError: OtherVersionResolutionError } =
      await import('../classes/version-resolution-error.js')

    expect(OtherVersionResolutionError).not.toBe(VersionResolutionError)

    const foreignError = new OtherVersionResolutionError('x')

    expect(foreignError instanceof VersionResolutionError).toBe(true)
    expect(VersionResolutionError.isVersionResolutionError(foreignError)).toBe(
      true
    )
  })

  test('other errors are not recognized', () => {
    const lookalike = Object.assign(new Error('x'), {
      name: 'VersionResolutionError',
      status: 400,
    })

    expect(lookalike instanceof VersionResolutionError).toBe(false)
    expect(VersionResolutionError.isVersionResolutionError(lookalike)).toBe(
      false
    )
    expect(VersionResolutionError.isVersionResolutionError(null)).toBe(false)
  })

  test('subclasses keep the prototype chain check', () => {
    class CustomError extends VersionResolutionError {}

    expect(new CustomError('x') instanceof VersionResolutionError).toBe(true)
    expect(new VersionResolutionError('x') instanceof CustomError).toBe(false)
  })
})
