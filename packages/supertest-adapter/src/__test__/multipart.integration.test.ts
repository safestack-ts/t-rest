import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  BagOfRoutes,
  Route,
  ValidationError,
  VersionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import {
  AxiosHTTPAdapter,
  RESTClient,
  versionInjectorFrom as clientVersionInjectorFrom,
} from '@t-rest/client'
import {
  TypedExpressApplication,
  versionExtractorFrom,
} from '@t-rest/express-server'
import { versionHeader } from '@t-rest/protocol'
import axios from 'axios'
import Express from 'express'
import multer from 'multer'
import { z } from 'zod'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { versionInjectorFrom } from '../utils/version-injector-from.js'

const versionHistory = VersionHistory(['2024-01-01'] as const)
const convention = versionHeader('x-version')

const fileSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  mimetype: z.string(),
  buffer: z.custom<Buffer>((value) => Buffer.isBuffer(value)),
})

type ErrorBody = { issues: unknown[] }

type UploadResult = {
  name: string
  tags: string[]
  files: { field: string; name: string; type: string; content: string }[]
}

const uploadValidator = z.object({
  params: z.object({ listId: z.string() }),
  body: z.object({
    name: z.string(),
    tags: ze.jsonObject(z.array(z.string())),
  }),
  files: z.array(fileSchema),
})

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/lists/:listId/uploads')
      .multipart()
      .validate(uploadValidator)
      .response<UploadResult>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .put('/avatar')
      .multipart()
      .validate(z.object({ file: fileSchema }))
      .response<{ name: string }>()
  )
  .build()

const toResult = (
  body: { name: string; tags: string[] },
  files: z.infer<typeof fileSchema>[]
): UploadResult => ({
  ...body,
  files: files.map((file) => ({
    field: file.fieldname,
    name: file.originalname,
    type: file.mimetype,
    content: file.buffer.toString(),
  })),
})

const makeApplication = () => {
  const expressApp = Express()
  const upload = multer({ storage: multer.memoryStorage() })
  const app = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versionHistory,
    versionExtractorFrom(convention, {
      parseDate: (version) => new Date(version),
    })
  )

  app
    .post('/lists/:listId/uploads')
    .version('2024-01-01')
    .middleware(upload.any())
    .handle((_, { body, files }, response) => {
      response.json(toResult(body, files))
    })

  app
    .put('/avatar')
    .version('2024-01-01')
    .middleware(upload.single('avatar'))
    .handle((_, { file }, response) => {
      response.json({ name: file.originalname })
    })

  expressApp.use(
    (
      error: unknown,
      _: Express.Request,
      response: Express.Response,
      next: Express.NextFunction
    ) => {
      if (ValidationError.isValidationError(error)) {
        response.status(400).json({
          issues: error.issues.map(({ path }) => ({ path })),
        })
      } else {
        next(error)
      }
    }
  )

  return { app, expressApp }
}

const expectedResult: UploadResult = {
  name: 'winter',
  tags: ['a', 'b'],
  files: [
    {
      field: 'prices',
      name: 'prices.csv',
      type: 'text/csv',
      content: 'a,b',
    },
  ],
}

describe('multipart requests through the supertest adapter', () => {
  const { app } = makeApplication()
  const adapter = SupertestAdapter.withVersioning(
    app,
    versionInjectorFrom(convention)
  )
  let directory: string

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 't-rest-multipart-'))
  })

  afterAll(() => rm(directory, { recursive: true }))

  test('sends fields and buffers', async () => {
    const response = await adapter.post(
      '/lists/:listId/uploads',
      '2024-01-01',
      {
        params: { listId: '1' },
        multipart: {
          fields: { name: 'winter', tags: '["a","b"]' },
          files: [
            {
              field: 'prices',
              buffer: Buffer.from('a,b'),
              filename: 'prices.csv',
              contentType: 'text/csv',
            },
          ],
        },
        expect: { status: 200 },
      }
    )

    expect(response.body).toEqual(expectedResult)
  })

  test('sends files from a path', async () => {
    const filePath = path.join(directory, 'prices.csv')
    await writeFile(filePath, 'a,b')

    const response = await adapter.post(
      '/lists/:listId/uploads',
      '2024-01-01',
      {
        params: { listId: '1' },
        multipart: {
          fields: { name: 'winter', tags: '["a","b"]' },
          files: [{ field: 'prices', path: filePath }],
        },
        expect: { status: 200 },
      }
    )

    expect(response.body).toEqual(expectedResult)
  })

  test('sends a file without fields to a route validating no body', async () => {
    const response = await adapter.put('/avatar', '2024-01-01', {
      multipart: {
        files: [
          {
            field: 'avatar',
            buffer: Buffer.from('png'),
            filename: 'me.png',
          },
        ],
      },
      expect: { status: 200 },
    })

    expect(response.body).toEqual({ name: 'me.png' })
  })

  test('is not affected by a json content type in the default headers', async () => {
    const adapterWithJsonDefault = SupertestAdapter.withVersioning(
      app,
      versionInjectorFrom(convention),
      { headers: { 'Content-Type': 'application/json' } }
    )

    const response = await adapterWithJsonDefault.put('/avatar', '2024-01-01', {
      multipart: {
        files: [
          { field: 'avatar', buffer: Buffer.from('png'), filename: 'me.png' },
        ],
      },
      expect: { status: 200 },
    })

    expect(response.body).toEqual({ name: 'me.png' })
  })

  test('validation errors of multipart requests are reported', async () => {
    const response = await adapter.put('/avatar', '2024-01-01', {
      multipart: { fields: { unrelated: 'value' } },
      expect: { status: 400 },
    })

    expect((response.body as unknown as ErrorBody).issues).toEqual([
      expect.objectContaining({ path: ['file'] }),
    ])
  })
})

describe('multipart requests through the rest client', () => {
  let server: Server
  let baseURL: string

  const makeFormData = () => {
    const formData = new FormData()
    formData.set('name', 'winter')
    formData.set('tags', '["a","b"]')
    formData.set(
      'prices',
      new File(['a,b'], 'prices.csv', { type: 'text/csv' })
    )
    return formData
  }

  const makeClient = (headers?: Record<string, string>) =>
    RESTClient.withVersioning(
      bagOfRoutes,
      '2024-01-01',
      new AxiosHTTPAdapter(axios.create({ baseURL, headers, adapter: 'http' })),
      clientVersionInjectorFrom(convention)
    )

  beforeAll(async () => {
    const { expressApp } = makeApplication()
    await new Promise<void>((resolve) => {
      server = expressApp.listen(0, () => resolve())
    })
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  test('sends form data', async () => {
    const response = await makeClient().post('/lists/:listId/uploads', {
      params: { listId: '1' },
      body: makeFormData(),
    })

    expect(response.data).toEqual(expectedResult)
  })

  test('sends form data with a json content type as axios default', async () => {
    const client = makeClient({ 'Content-Type': 'application/json' })

    const response = await client.post('/lists/:listId/uploads', {
      params: { listId: '1' },
      body: makeFormData(),
    })

    expect(response.data).toEqual(expectedResult)
  })
})
