import { MultipartFileParts } from '@t-rest/core'

const binary = { type: 'string', format: 'binary' }
const componentRefPrefix = '#/components/schemas/'

/**
 * A body referencing an object component is inlined: within `allOf` the
 * constraints of the component, e.g. `additionalProperties`, would apply to the
 * file parts as well. The component itself stays as it is for other uses.
 */
const resolveBodySpec = (
  bodySpec: Record<string, any>,
  components: Record<string, any>
): Record<string, any> => {
  if (
    typeof bodySpec.$ref !== 'string' ||
    !bodySpec.$ref.startsWith(componentRefPrefix)
  ) {
    return bodySpec
  }

  const component = components[bodySpec.$ref.slice(componentRefPrefix.length)]

  return component?.type === 'object' && component.$ref === undefined
    ? component
    : bodySpec
}

/**
 * The schema of a multipart body: the validated text fields plus the declared
 * file fields as binary parts. A body that is no object, e.g. a union, gets the
 * files through `allOf`.
 */
export const multipartRequestSchema = (
  bodySpec: Record<string, any> | undefined,
  files: MultipartFileParts | undefined,
  components: Record<string, any> = {}
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

  const textSchema = resolveBodySpec(bodySpec, components)

  if (textSchema.type === 'object' && textSchema.$ref === undefined) {
    // a text field and a file part may share a name
    const required = [
      ...new Set([...(textSchema.required ?? []), ...requiredFiles]),
    ]

    return {
      ...textSchema,
      properties: { ...textSchema.properties, ...fileProperties },
      ...(required.length > 0 && { required }),
    }
  }

  return { allOf: [bodySpec, fileSchema] }
}
