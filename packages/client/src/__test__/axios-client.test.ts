import axios from 'axios'
import nock from 'nock'
import { RESTClient } from '../classes/rest-client.js'
import { demoBagOfRoutes } from '@t-rest/core'
import { AxiosHTTPAdapter } from '../classes/axios-http-adapter.js'
import { VersionInjector } from '../classes/version-injector.js'

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
    .matchHeader('x-version', '2024-03-01')
    .reply(200, { id: 1, entries: [] })

  const response = await apiClient.get('/basket')

  expect(response.data).toEqual({ id: 1, entries: [] })

  scope.done()
})

test('POST request works', async () => {
  const scope = nock('http://localhost')
    .post('/basket', { entries: [{ id: 'a' }, { id: 'b' }] })
    .matchHeader('x-version', '2024-03-01')
    .reply(201, { id: 42 })

  const response = await apiClient.post('/basket', {
    body: {
      entries: [{ id: 'a' }, { id: 'b' }],
    },
  })

  expect(response.data).toEqual({ id: 42 })

  scope.done()
})

test('path params are replaced', async () => {
  const scope = nock('http://localhost')
    .get('/basket/123/entries')
    .reply(200, [{ id: 'a' }, { id: 'b' }])

  const response = await apiClient.get('/basket/:basketId/entries', {
    params: {
      basketId: '123',
    },
  })

  expect(response.data).toEqual([{ id: 'a' }, { id: 'b' }])

  scope.done()
})
