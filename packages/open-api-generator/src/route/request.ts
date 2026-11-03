import type { BodyEncoding, MultipartFileParts } from '@t-rest/core'
import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import { dereference, withDocs } from '../model/shape.js'
import type {
  DefKey,
  Example,
  Field,
  MediaType,
  Parameter,
  RequestBody,
  Shape,
  TypeDef,
} from '../model/types.js'
import { pointerTo } from '../reader/json-schema.js'
import type { RequestRead } from '../reader/read-request.js'

type Types = Readonly<Record<DefKey, TypeDef<DefKey>>>

export const fieldsOf = (
  shape: Shape<DefKey> | undefined,
  types: Types
): readonly Field<DefKey>[] => {
  const root = shape && dereference(shape, types)
  return root?.kind === 'object' ? root.fields : []
}

const STRUCTURED = new Set(['object', 'array', 'tuple'])

/**
 * The members of a union, through refs and nested unions; any other shape is
 * its own member. A union reached again through its own members adds nothing.
 */
const membersOf = (
  shape: Shape<DefKey>,
  types: Types,
  enclosing: ReadonlySet<Shape<DefKey>> = new Set()
): Shape<DefKey>[] => {
  const target = dereference(shape, types)
  if (target.kind !== 'union') return [shape]
  if (enclosing.has(target)) return []
  const unions = new Set(enclosing).add(target)
  return target.members.flatMap((member) => membersOf(member, types, unions))
}

/** The JSON text of a structured member, as `ze.jsonObject` marks it. */
const isJsonText = (shape: Shape<DefKey>) =>
  shape.kind === 'string' && shape.contentMediaType === 'application/json'

/** A value `encodeQuery` sends unquoted, which a JSON parameter cannot describe. */
const isText = (shape: Shape<DefKey>) =>
  (shape.kind === 'string' && !isJsonText(shape)) ||
  (shape.kind === 'enum' && shape.values.some((v) => typeof v === 'string'))

/** The decoded value of a JSON query parameter: a union loses its JSON text members. */
const jsonBranch = (shape: Shape<DefKey>, types: Types): Shape<DefKey> => {
  const target = dereference(shape, types)
  if (target.kind !== 'union') return shape
  const members = membersOf(shape, types).filter(
    (member) => !isJsonText(dereference(member, types))
  )
  const branch = members.length === 1 ? members[0] : { ...target, members }
  return withDocs(
    branch,
    shape === target ? target.docs : { ...target.docs, ...shape.docs }
  )
}

interface QueryParameter {
  readonly parameter: Parameter<DefKey>
  readonly diagnostics: readonly Diagnostic[]
}

// `encodeQuery` sends objects and arrays as JSON strings, every other value as is.
const queryParameter = (
  field: Field<DefKey>,
  types: Types,
  operation: string
): QueryParameter => {
  const members = membersOf(field.shape, types).map((member) =>
    dereference(member, types)
  )
  const json = members.some((member) => STRUCTURED.has(member.kind))
  const parameter: Parameter<DefKey> = {
    name: field.name,
    in: 'query',
    required: field.required,
    shape: json ? jsonBranch(field.shape, types) : field.shape,
    encoding: json ? 'json' : 'plain',
  }
  if (!json || !members.some(isText)) return { parameter, diagnostics: [] }
  return {
    parameter,
    diagnostics: [
      diagnostic(
        'operation/mixed-query-encoding',
        {
          operation,
          slot: 'request',
          pointer: pointerTo(
            '',
            'properties',
            'query',
            'properties',
            field.name
          ),
        },
        { parameter: field.name }
      ),
    ],
  }
}

const parameter = (
  location: 'path' | 'header',
  { name, required, shape }: Field<DefKey>
): Parameter<DefKey> => ({
  name,
  in: location,
  required: location === 'path' || required,
  shape,
  encoding: 'plain',
})

export interface ParameterSources {
  readonly read: RequestRead
  readonly routeHeaders: readonly Field<DefKey>[]
  readonly globalHeaders: readonly Field<DefKey>[]
  /** Lower-cased names of the headers a security scheme in effect sends. */
  readonly covered: ReadonlyMap<string, string>
  readonly types: Types
  readonly operation: string
}

/** Header (route, then global), path and query parameters. */
export const parametersOf = ({
  read,
  routeHeaders,
  globalHeaders,
  covered,
  types,
  operation,
}: ParameterSources): {
  readonly parameters: Parameter<DefKey>[]
  readonly diagnostics: Diagnostic[]
} => {
  const routeNames = new Set(routeHeaders.map(({ name }) => name.toLowerCase()))
  const headers = [
    ...routeHeaders,
    ...globalHeaders.filter(({ name }) => !routeNames.has(name.toLowerCase())),
  ].filter(({ name }) => !covered.has(name.toLowerCase()))

  const query = fieldsOf(read.query, types).map((field) =>
    queryParameter(field, types, operation)
  )
  return {
    parameters: [
      ...headers.map((field) => parameter('header', field)),
      ...read.params.map((field) => parameter('path', field)),
      ...query.map(({ parameter }) => parameter),
    ],
    diagnostics: query.flatMap(({ diagnostics }) => diagnostics),
  }
}

export const FILE_CONTENT_TYPE = 'application/octet-stream'

const binary: Shape<DefKey> = {
  kind: 'string',
  contentMediaType: FILE_CONTENT_TYPE,
}

/** The validated text fields plus the declared file parts, which replace text fields of their name. */
const multipartShape = (
  body: Shape<DefKey> | undefined,
  files: MultipartFileParts,
  types: Types
): Shape<DefKey> => {
  const fileFields: Field<DefKey>[] = Object.entries(files).map(
    ([name, part]) => ({
      name,
      required: part.required ?? false,
      shape: part.multiple ? { kind: 'array', items: binary } : binary,
    })
  )
  if (fileFields.length === 0) return body ?? { kind: 'object', fields: [] }
  if (body === undefined) return { kind: 'object', fields: fileFields }

  // a referenced object is inlined, so its own closedness does not reject the files
  const text = dereference(body, types)
  if (text.kind !== 'object')
    return {
      kind: 'intersection',
      members: [body, { kind: 'object', fields: fileFields }],
    }

  const textNames = new Set(text.fields.map(({ name }) => name))
  const fields = text.fields.map((field) => {
    const file = fileFields.find(({ name }) => name === field.name)
    return file ? { ...file, required: field.required || file.required } : field
  })
  return {
    ...text,
    fields: [
      ...fields,
      ...fileFields.filter(({ name }) => !textNames.has(name)),
    ],
  }
}

export interface BodySources {
  readonly body: RequestRead['body']
  readonly bodyEncoding: BodyEncoding
  readonly files: MultipartFileParts
  readonly examples: Readonly<Record<string, Example>>
  readonly types: Types
}

export const requestBodyOf = ({
  body,
  bodyEncoding,
  files,
  examples,
  types,
}: BodySources): RequestBody<DefKey> | undefined => {
  const media = (shape: Shape<DefKey>): MediaType<DefKey> => ({
    shape,
    ...(Object.keys(examples).length > 0 && { examples }),
  })
  const fileNames = Object.keys(files)
  const content: Record<string, MediaType<DefKey>> = {
    ...(bodyEncoding !== 'multipart' &&
      body && { 'application/json': media(body.shape) }),
    ...(bodyEncoding !== 'json' && {
      'multipart/form-data': {
        ...media(multipartShape(body?.shape, files, types)),
        ...(fileNames.length > 0 && {
          encoding: Object.fromEntries(
            fileNames.map((name) => [name, { contentType: FILE_CONTENT_TYPE }])
          ),
        }),
      },
    }),
  }
  if (Object.keys(content).length === 0) return undefined

  const requiredFile =
    bodyEncoding === 'multipart' &&
    Object.values(files).some((part) => part.required)
  return { required: (body?.required ?? false) || requiredFile, content }
}
