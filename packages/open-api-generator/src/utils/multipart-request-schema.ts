import { MultipartFileParts } from '@t-rest/core'

const binary = { type: 'string', format: 'binary' }

/**
 * The schema of a multipart body: the validated text fields plus the declared
 * file fields as binary parts. A body referencing a component keeps its
 * reference and gets the files through `allOf`.
 */
export const multipartRequestSchema = (
  bodySpec: Record<string, any> | undefined,
  files: MultipartFileParts | undefined
): Record<string, any> => {
  const fileEntries = Object.entries(files ?? {})

  if (fileEntries.length === 0) {
    // the files of a route without text fields are not part of its validated
    // body
    return bodySpec ?? { type: 'object' }
  }

  const fileProperties = Object.fromEntries(
    fileEntries.map(([name, part]) => [
      name,
      part.multiple ? { type: 'array', items: binary } : binary,
    ])
  )
  const requiredFiles = fileEntries
    .filter(([, part]) => part.required)
    .map(([name]) => name)
  const fileSchema = {
    type: 'object',
    properties: fileProperties,
    ...(requiredFiles.length > 0 && { required: requiredFiles }),
  }

  if (bodySpec === undefined) {
    return fileSchema
  }

  if (bodySpec.type === 'object' && bodySpec.$ref === undefined) {
    const required = [...(bodySpec.required ?? []), ...requiredFiles]

    return {
      ...bodySpec,
      properties: { ...bodySpec.properties, ...fileProperties },
      ...(required.length > 0 && { required }),
    }
  }

  return { allOf: [bodySpec, fileSchema] }
}
