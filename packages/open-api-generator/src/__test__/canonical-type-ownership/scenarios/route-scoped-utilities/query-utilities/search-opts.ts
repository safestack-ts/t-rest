import { z } from 'zod'

// generic query helpers shared by many routes, without an owning public namespace

interface SearchOptsBase {
  key: string
}

export interface SearchOptsEq extends SearchOptsBase {
  operator: 'eq'
  value: string | number | boolean | null | Date
}

export interface SearchOptsIn extends SearchOptsBase {
  operator: 'in'
  values: string[] | number[]
}

export type SearchOpts = SearchOptsEq | SearchOptsIn

export type CheckSearchOptsComposedType = {
  OR?: Array<SearchOpts | CheckSearchOptsComposedType>
  AND?: Array<SearchOpts | CheckSearchOptsComposedType>
}

const checkSearchOpts = z.union([
  z.object({
    key: z.string(),
    operator: z.literal('eq'),
    value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.date()]),
  }),
  z.object({
    key: z.string(),
    operator: z.literal('in'),
    values: z.union([z.array(z.string()), z.array(z.number())]),
  }),
])

const checkSearchOptsComposed: z.ZodType<CheckSearchOptsComposedType> = z.lazy(
  () =>
    z.object({
      OR: z.array(checkSearchOptsUnion).optional(),
      AND: z.array(checkSearchOptsUnion).optional(),
    })
)

const checkSearchOptsUnion = z.union([checkSearchOpts, checkSearchOptsComposed])

const jsonObject = <TSchema extends z.ZodType>(schema: TSchema) =>
  z
    .string()
    .transform((value) => JSON.parse(value) as unknown)
    .pipe(schema)
    .or(schema)

export const parseCheckSearchOpts = jsonObject(checkSearchOptsUnion)
