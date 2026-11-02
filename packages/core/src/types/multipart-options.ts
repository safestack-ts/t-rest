/** A file field of a multipart route, documented as binary in OpenAPI. */
export type MultipartFilePart = {
  /** Several files are sent under the same field name. */
  multiple?: boolean
  required?: boolean
}

export type MultipartFileParts = Record<string, MultipartFilePart>

export type MultipartOptions = {
  /** The route also accepts the body as JSON. */
  json?: boolean
  /**
   * The file fields, by field name. The validator only sees what the upload
   * middleware made of them, so their names are declared here.
   */
  files?: MultipartFileParts
}
