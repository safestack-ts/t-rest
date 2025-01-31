import supertest from 'supertest'

export type SupertestResponse<TBody = undefined> = Omit<
  supertest.Response,
  'body'
> & { body: TBody }
