export type OpenAPIMetaData<TVersion extends string = string> = {
  title: string
  description: string
  version: TVersion

  contact?: {
    name?: string
    url?: string
    email?: string
  }

  servers?: {
    url: string
    description?: string
  }[]

  tags?: {
    name: string
    description?: string
    externalDocs?: {
      description?: string
      url: string
    }
  }[]
}
