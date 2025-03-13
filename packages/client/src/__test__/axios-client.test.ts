import axios from 'axios'
import nock from 'nock'
import { RESTClient } from '../classes/rest-client'
import { demoBagOfRoutes } from '@t-rest/core'
import { AxiosHTTPAdapter } from '../classes/axios-http-adapter'
import { VersionInjector } from '../classes/version-injector'

class TestVersionInjector extends VersionInjector {
  modifyHeaders(headers: Record<string, string | number | boolean>) {
    return {
      ...headers,
      'x-version': this.version,
    }
  }
}

class MyTestAdapter extends AxiosHTTPAdapter {}

axios.defaults.adapter = 'http'

const axiosInstance = axios.create({
  baseURL: 'http://localhost',
})
const apiClient = RESTClient.withVersioning(
  demoBagOfRoutes,
  '2024-03-01',
  new MyTestAdapter(axiosInstance),
  TestVersionInjector
)

test('GET request works', async () => {
  const scope = nock('http://localhost')
    .get('/basket')
    .reply(200, function () {
      expect(this.req.headers).toMatchObject({
        'x-version': '2024-03-01',
      })

      return { id: 1, entries: [] }
    })

  const response = await apiClient.get('/basket')

  expect(response.data).toEqual({ id: 1, entries: [] })

  scope.done()
})

test('POST request works', async () => {
  const scope = nock('http://localhost')
    .post('/basket', { entries: [{ id: 'a' }, { id: 'b' }] })
    .reply(201, function () {
      expect(this.req.headers).toMatchObject({
        'x-version': '2024-03-01',
      })

      return { id: 42 }
    })

  const response = await apiClient.post('/basket', {
    body: {
      entries: [{ id: 'a' }, { id: 'b' }],
    },
  })

  expect(response.data).toEqual({ id: 42 })

  scope.done()
})
