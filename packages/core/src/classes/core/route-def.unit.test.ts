import { describe, expect, test } from 'vitest'
import { Route } from './route.js'

describe('body encoding of routes', () => {
  test('is json by default', () => {
    expect(Route.post('/').response<null>().bodyEncoding).toBe('json')
  })

  test('.multipart() is kept along every builder chain', () => {
    const builder = Route.version('2024-01-01').post('/').multipart()
    const metaData = { description: 'upload' }

    const routes = [
      builder.response<null>(),
      builder.validate({}).response<null>(),
      builder.metaData(metaData).response<null>(),
      builder.validate({}).metaData(metaData).response<null>(),
      builder.metaData(metaData).validate({}).response<null>(),
    ]

    for (const route of routes) {
      expect(route.bodyEncoding).toBe('multipart')
      expect(route.version).toBe('2024-01-01')
      expect(route.method).toBe('POST')
    }
  })
})
