export type OpenAPISchema = {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
    contact?: {
      name?: string
      url?: string
      email?: string
    }
  }
  servers: {
    url: string
    description?: string
  }[]
  tags: {
    name: string
    description?: string
  }[]

  paths: {
    [key: string]: {
      [key: string]: OpenAPIRouteSchema
    }
  }
}

export type OpenAPIRouteSchema = {
  summary?: string
  description?: string
  tags?: string[]
  operationId?: string
  parameters?: OpenAPIParameterSchema[]
  responses: {
    [key: string]: OpenAPIResponseSchema
  }
}

export type OpenAPIParameterSchema = {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  description?: string
  required?: boolean
  schema: any
}

export type OpenAPIResponseSchema = {
  description: string
  content: {
    [key: string]: any
  }
}
