import supertest from 'supertest'

export type DefaultSupertestAdapterConfig = {
  headers?: Record<string, string>
  /**
   * Root express application (or http server) the requests are sent to.
   * Required if the typed application is built on an express router: the
   * router alone misses the middlewares and the mount path of its parent
   * application. Defaults to the express application of the typed application.
   */
  expressApp?: Parameters<typeof supertest>[0]
}
