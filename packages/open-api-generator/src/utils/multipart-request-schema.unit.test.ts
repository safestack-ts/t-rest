import { expect, test } from 'vitest'
import { multipartRequestSchema } from './multipart-request-schema.js'

test('adds the files to a referenced body through allOf', () => {
  expect(
    multipartRequestSchema(
      { $ref: '#/components/schemas/Upload' },
      { file: { required: true } }
    )
  ).toEqual({
    allOf: [
      { $ref: '#/components/schemas/Upload' },
      {
        type: 'object',
        properties: { file: { type: 'string', format: 'binary' } },
        required: ['file'],
      },
    ],
  })
})
