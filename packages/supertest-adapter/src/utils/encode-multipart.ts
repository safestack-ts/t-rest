import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { lookup } from 'mime-types'
import { MultipartBody } from '../types/multipart.js'
import { multipartFieldEntries } from './multipart-field-entries.js'

/**
 * Encodes a form the way a browser does, so the caller decides on the content
 * type it is sent with. A form without parts still is a multipart body.
 */
export const encodeMultipart = async (multipart: MultipartBody) => {
  const form = new FormData()

  for (const [name, value] of multipartFieldEntries(multipart.fields ?? {})) {
    form.append(name, value)
  }

  for (const file of multipart.files ?? []) {
    const content = file.buffer ?? (await readFile(file.path))
    const filename = file.filename ?? path.basename(file.path as string)
    const type =
      file.contentType ?? (lookup(filename) || 'application/octet-stream')

    form.append(
      file.field,
      new Blob([new Uint8Array(content)], { type }),
      filename
    )
  }

  const encoded = new Response(form)

  return {
    body: Buffer.from(await encoded.arrayBuffer()),
    contentType: encoded.headers.get('content-type') as string,
  }
}
