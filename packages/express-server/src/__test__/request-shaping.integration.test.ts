import { describe, expect, test } from 'vitest'
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
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressRequestHandler,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'

const versionHistory = VersionHistory(['2024-01-01'] as const)

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

type UploadedFile = {
  fieldname: string
  originalname: string
  mimetype: string
  buffer: Buffer
}

const fileSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  mimetype: z.enum(['text/csv', 'application/pdf']),
  buffer: z.custom<Buffer>((value) => Buffer.isBuffer(value)),
})

// mimics multer, which adds `files` (`.any()`) or `file` (`.single()`) to the
// request and replaces the body with the text fields of the multipart body
const fakeMulter =
  (mode: 'any' | 'single'): ExpressRequestHandler =>
  (request, _, next) => {
    const files: UploadedFile[] = [
      {
        fieldname: 'file',
        originalname: 'prices.csv',
        mimetype: request.header('x-file-type') ?? 'text/csv',
        buffer: Buffer.from('a,b'),
      },
    ]
    const requestWithFiles = request as ExpressRequest & {
      files?: UploadedFile[]
      file?: UploadedFile
    }

    if (mode === 'any') {
      requestWithFiles.files = files
    } else {
      requestWithFiles.file = files[0]
    }
    request.body = { fields: request.header('x-fields') ?? '{}' }
    next()
  }

// mimics express-jwt-authz, a plain express handler forwarding errors to next
const checkScopes =
  (scopes: string[]): ExpressRequestHandler =>
  (request, _, next) => {
    const granted = (request.header('x-scopes') ?? '').split(' ')

    if (!scopes.every((scope) => granted.includes(scope))) {
      return next(
        Object.assign(new Error('Insufficient scope'), { status: 403 })
      )
    }
    next()
  }

const errorHandler = (
  error: Error & { status?: number },
  _: ExpressRequest,
  response: ExpressResponse,
  __: ExpressNextFunction
) => {
  if (ValidationError.isValidationError(error)) {
    response.status(StatusCodes.BAD_REQUEST).json({
      issues: error.issues.map(({ message, path }) => ({
        message,
        path: path?.map((segment) =>
          typeof segment === 'object' ? segment.key : segment
        ),
      })),
    })
    return
  }

  response
    .status(error.status ?? StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: error.message })
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/uploads/any')
      .validate(
        z.object({
          files: z.array(fileSchema).optional(),
          body: z.object({
            fields: z
              .string()
              .transform((value) => JSON.parse(value))
              .pipe(z.strictObject({ name: z.string() })),
          }),
        })
      )
      .response<{ fileNames: string[]; name: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/uploads/single')
      .validate(z.object({ file: fileSchema }))
      .response<{ fileName: string; size: number }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/checkouts/:checkoutId')
      .validate(
        z.object({
          params: z.object({ checkoutId: ze.parseInteger() }),
          body: z.strictObject({
            formValues: z.record(z.string(), z.string()),
          }),
        })
      )
      .response<{ checkoutId: number; formValues: Record<string, string> }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/protected')
      .validate(z.object({ query: z.strictObject({ id: ze.parseInteger() }) }))
      .response<{ id: number }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      // a top level union of whole request shapes
      .post('/baskets/admin')
      .validate(
        z.union([
          z.object({
            query: z.object({ mode: z.literal('copy') }),
            body: z.strictObject({ sourceBasketId: ze.parseInteger() }),
          }),
          z.object({
            query: z.object({ mode: z.literal('new') }),
            body: z.strictObject({ name: z.string() }),
          }),
        ])
      )
      .response<{ mode: string; body: unknown }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/discounts')
      .validate(
        z.object({
          body: z.discriminatedUnion('type', [
            z.object({
              type: z.literal('percentage'),
              percent: z.number().max(100),
            }),
            z.object({
              type: z.literal('amount'),
              amount: z.number().positive(),
            }),
          ]),
        })
      )
      .response<{ type: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .patch('/price-changes/:priceChangeId')
      .validate(
        z.object({
          params: z.object({ priceChangeId: ze.parseDatabaseId() }),
          body: z
            .object({
              priceChangeDate: ze.parseDate().optional(),
              notificationDate: ze.parseDate().optional(),
            })
            .refine(
              ({ priceChangeDate, notificationDate }) =>
                !priceChangeDate ||
                !notificationDate ||
                notificationDate < priceChangeDate,
              {
                message: 'notificationDate must be before priceChangeDate',
                path: ['notificationDate'],
              }
            ),
        })
      )
      .response<{ priceChangeId: number; days: number | null }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/products')
      .validate(
        z.object({
          query: z.object({
            page: ze.parseInteger().optional().default(0),
            pageSize: ze.parseInteger().optional().default(20),
            ids: ze.jsonObject(z.array(z.number().int())).optional(),
            active: ze.parseBoolean().optional(),
          }),
        })
      )
      .response<{
        rawQuery: unknown
        query: {
          page: number
          pageSize: number
          ids?: number[]
          active?: boolean
        }
      }>()
  )
  .build()

const initApplication = () => {
  const expressApp = Express()
  expressApp.use(Express.json())

  const app = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor()
  )

  app
    .post('/uploads/any')
    .version('2024-01-01')
    .middleware(checkScopes(['write:prices']))
    .middleware(fakeMulter('any'))
    .handle((_, { files, body: { fields } }, response) => {
      response.json({
        fileNames: (files ?? []).map((file) => file.originalname),
        name: fields.name,
      })
    })

  app
    .post('/uploads/single')
    .version('2024-01-01')
    .middleware(fakeMulter('single'))
    .handle((_, { file }, response) => {
      response.json({ fileName: file.originalname, size: file.buffer.length })
    })

  app
    .post('/checkouts/:checkoutId')
    .version('2024-01-01')
    // rewrites a list of form values into a record before validation
    .middleware((request, _, next) => {
      const { formValues } = request.body as {
        formValues: { key: string; value: string }[]
      }
      request.body = {
        formValues: Object.fromEntries(
          formValues.map(({ key, value }) => [key, value])
        ),
      }
      next()
    })
    .handle((_, { params, body }, response) => {
      response.json({
        checkoutId: params.checkoutId,
        formValues: body.formValues,
      })
    })

  app
    .get('/protected')
    .version('2024-01-01')
    .middleware(checkScopes(['read:protected']))
    .handle((_, { query }, response) => {
      response.json(query)
    })

  app
    .post('/baskets/admin')
    .version('2024-01-01')
    .handle((_, input, response) => {
      response.json({ mode: input.query.mode, body: input.body })
    })

  app
    .post('/discounts')
    .version('2024-01-01')
    .handle((_, { body }, response) => {
      response.json({ type: body.type })
    })

  app
    .patch('/price-changes/:priceChangeId')
    .version('2024-01-01')
    .handle((_, { params, body }, response) => {
      const { priceChangeDate, notificationDate } = body
      response.json({
        priceChangeId: params.priceChangeId,
        days:
          priceChangeDate && notificationDate
            ? (priceChangeDate.getTime() - notificationDate.getTime()) /
              86400000
            : null,
      })
    })

  app
    .get('/products')
    .version('2024-01-01')
    .handle((request, { query }, response) => {
      response.json({ rawQuery: request.query, query })
    })

  expressApp.use(errorHandler)

  return expressApp
}

describe('route middlewares shaping the request before validation', () => {
  test('files added by a multer-like middleware are validated', async () => {
    const response = await request(initApplication())
      .post('/uploads/any')
      .set('x-scopes', 'write:prices')
      .set('x-fields', JSON.stringify({ name: 'winter' }))
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ fileNames: ['prices.csv'], name: 'winter' })
  })

  test('an invalid file added by a middleware is reported', async () => {
    const response = await request(initApplication())
      .post('/uploads/single')
      .set('x-file-type', 'image/png')
      .expect(StatusCodes.BAD_REQUEST)

    expect(response.body.issues).toEqual([
      expect.objectContaining({ path: ['file', 'mimetype'] }),
    ])
  })

  test('a single file added by a middleware is validated', async () => {
    await request(initApplication())
      .post('/uploads/single')
      .expect(StatusCodes.OK, { fileName: 'prices.csv', size: 3 })
  })

  test('text fields replaced by a middleware are parsed by the validator', async () => {
    const response = await request(initApplication())
      .post('/uploads/any')
      .set('x-scopes', 'write:prices')
      .set('x-fields', JSON.stringify({ name: 'winter', unknown: true }))
      .expect(StatusCodes.BAD_REQUEST)

    expect(response.body.issues).toEqual([
      expect.objectContaining({ path: ['body', 'fields'] }),
    ])
  })

  test('a body rewritten by a middleware is validated', async () => {
    await request(initApplication())
      .post('/checkouts/5')
      .send({ formValues: [{ key: 'firstName', value: 'Jon' }] })
      .expect(StatusCodes.OK, {
        checkoutId: 5,
        formValues: { firstName: 'Jon' },
      })
  })

  test('a plain express middleware rejecting the request runs before validation', async () => {
    // the upload is invalid as well, but the scope check comes first
    await request(initApplication())
      .post('/uploads/any')
      .set('x-fields', 'not-json')
      .expect(StatusCodes.FORBIDDEN, { error: 'Insufficient scope' })

    await request(initApplication())
      .get('/protected?id=abc')
      .expect(StatusCodes.FORBIDDEN)
  })

  test('a plain express middleware calling next() continues to validation', async () => {
    const app = initApplication()

    await request(app)
      .get('/protected?id=abc')
      .set('x-scopes', 'read:protected')
      .expect(StatusCodes.BAD_REQUEST)
    await request(app)
      .get('/protected?id=3')
      .set('x-scopes', 'read:protected')
      .expect(StatusCodes.OK, { id: 3 })
  })
})

describe('validator features', () => {
  test('a top level union picks the matching request shape', async () => {
    const app = initApplication()

    await request(app)
      .post('/baskets/admin?mode=copy')
      .send({ sourceBasketId: '12' })
      .expect(StatusCodes.OK, { mode: 'copy', body: { sourceBasketId: 12 } })
    await request(app)
      .post('/baskets/admin?mode=new')
      .send({ name: 'basket' })
      .expect(StatusCodes.OK, { mode: 'new', body: { name: 'basket' } })
  })

  test('a top level union rejects a request matching no shape', async () => {
    await request(initApplication())
      .post('/baskets/admin?mode=new')
      .send({ sourceBasketId: '12' })
      .expect(StatusCodes.BAD_REQUEST)
  })

  test('a discriminated union body is validated by its discriminator', async () => {
    const app = initApplication()

    await request(app)
      .post('/discounts')
      .send({ type: 'amount', amount: 5 })
      .expect(StatusCodes.OK, { type: 'amount' })

    const response = await request(app)
      .post('/discounts')
      .send({ type: 'percentage', percent: 120 })
      .expect(StatusCodes.BAD_REQUEST)
    expect(response.body.issues).toEqual([
      expect.objectContaining({ path: ['body', 'percent'] }),
    ])
  })

  test('a cross field refinement reports its issue path', async () => {
    const response = await request(initApplication())
      .patch('/price-changes/1')
      .send({ priceChangeDate: '2025-01-01', notificationDate: '2025-02-01' })
      .expect(StatusCodes.BAD_REQUEST)

    expect(response.body.issues).toEqual([
      {
        message: 'notificationDate must be before priceChangeDate',
        path: ['body', 'notificationDate'],
      },
    ])
  })

  test('transformed values of a refined body reach the handler', async () => {
    await request(initApplication())
      .patch('/price-changes/1')
      .send({ priceChangeDate: '2025-01-11', notificationDate: '2025-01-01' })
      .expect(StatusCodes.OK, { priceChangeId: 1, days: 10 })
  })

  test('database ids reject zero', async () => {
    await request(initApplication())
      .patch('/price-changes/0')
      .send({})
      .expect(StatusCodes.BAD_REQUEST)
  })

  test('defaults and transforms are applied to the validation output only', async () => {
    const response = await request(initApplication())
      .get('/products')
      .query({ ids: JSON.stringify([1, 2]), active: 'true' })
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({
      rawQuery: { ids: '[1,2]', active: 'true' },
      query: { page: 0, pageSize: 20, ids: [1, 2], active: true },
    })
  })

  test('invalid json in the query is reported', async () => {
    const response = await request(initApplication())
      .get('/products')
      .query({ ids: '[1,' })
      .expect(StatusCodes.BAD_REQUEST)

    expect(response.body.issues).toEqual([
      expect.objectContaining({ path: ['query', 'ids'] }),
    ])
  })
})
