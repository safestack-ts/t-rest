import { z } from 'zod'

const integerRegex = /^[+-]?\d+$/
const floatingRegex = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i

const isIntegerString = (value: string) =>
  integerRegex.test(value) && Number.isSafeInteger(Number(value))

const isFloatingString = (value: string) =>
  floatingRegex.test(value) && Number.isFinite(Number(value))

const tryParseJSON = (
  value: string
): { success: true; data: any } | { success: false } => {
  try {
    return { success: true, data: JSON.parse(value) }
  } catch {
    return { success: false }
  }
}

export namespace ze {
  // Refinements
  export const booleanString = () =>
    z.string().refine((value) => value === 'true' || value === 'false', {
      message: 'Expected boolean string',
    })

  export const numberString = () =>
    z.string().refine((value) => value.trim() !== '' && !isNaN(+value), {
      message: 'Expected number string',
    })

  export const integerString = () =>
    z.string().refine(isIntegerString, {
      message: 'Expected integer string',
    })

  export const floatString = () =>
    z
      .string()
      .refine(
        (value) =>
          /^-?\d+(?:[.,]\d*?)?$/.test(value) && !isNaN(parseFloat(value)),
        {
          message: 'Expected float string',
        }
      )

  export const dateString = () =>
    z.string().refine(
      (value) => {
        const date = new Date(value)
        return dateStringHasSomeSeparator(value) && !isNaN(date.valueOf())
      },
      {
        message: 'Expected date string',
      }
    )

  const dateStringHasSomeSeparator = (value: string) =>
    value.match(/\.|-|:|\//) !== null

  export const iso8601DateString = () =>
    z.string().refine(
      (value) => {
        const regex =
          /^([+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24:?00)([.,]\d+(?!:))?)?(\17[0-5]\d([.,]\d+)?)?([zZ]|([+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/
        return (
          value.trim().length > 4 &&
          dateStringHasSomeSeparator(value) &&
          regex.test(value)
        )
      },
      {
        message: 'Expected ISO8601 date string',
      }
    )

  export const uuid = () =>
    z.string().refine(
      (value) => {
        const regex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        const nilOrMax =
          /^(?:0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i
        return regex.test(value) || nilOrMax.test(value)
      },
      {
        message: 'Expected UUID string',
      }
    )

  export const jsonString = <T extends z.ZodTypeAny>(zodType: T) =>
    z.string().refine(
      (value) => {
        const parsedJSON = tryParseJSON(value)
        return parsedJSON.success && zodType.safeParse(parsedJSON.data).success
      },
      {
        message: 'Expected JSON string',
      }
    )

  export const jsonObject = <TOutputValue>(
    objectValidator: z.ZodType<TOutputValue, unknown>
  ) =>
    z
      .string()
      .transform((value, ctx) => {
        const parsedJSON = tryParseJSON(value)

        if (!parsedJSON.success) {
          ctx.addIssue({
            code: 'custom',
            message: 'Expected JSON string',
          })
          return z.NEVER
        }

        return parsedJSON.data
      })
      .pipe(objectValidator)
      .or(objectValidator)

  export const databaseId = () => z.number().int().positive()

  export const parseInteger = (): z.ZodType<number, number | string> =>
    z.union([
      z.number().int(),
      integerString().transform((value) => Number(value)),
    ])

  export const parseFloating = (): z.ZodType<number, number | string> =>
    z.union([
      z.number(),
      z.string().transform((value, ctx) => {
        if (!isFloatingString(value)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Expected parseable floating number string',
          })
          return z.NEVER
        }

        return Number(value)
      }),
    ])

  export const parseBoolean = (): z.ZodType<boolean, boolean | string> =>
    z.union([
      z.boolean(),
      booleanString().transform((value) => value === 'true'),
    ])

  export const parseDate = () =>
    dateString()
      .transform((value) => new Date(value))
      .or(z.date())

  export const parseCSV = () =>
    z.string().transform((value) => {
      if (value.trim().length === 0) {
        return []
      }

      return value.split(',')
    })

  export const parseCSVTrimmed = () =>
    z.string().transform((value) => {
      return parseCSV()
        .parse(value)
        .map((str) => str.trim())
    })

  export const parseCSVInteger = () =>
    z.string().transform((value, ctx) => {
      if (value.trim().length === 0) {
        return []
      }

      const values = value.split(',').map((str) => str.trim())

      if (!values.every(isIntegerString)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Expected comma separated integer string',
        })
        return z.NEVER
      }

      return values.map(Number)
    })

  export const parseJSON = () =>
    z.string().transform((value, ctx) => {
      const parsedJSON = tryParseJSON(value)

      if (!parsedJSON.success) {
        ctx.addIssue({
          code: 'custom',
          message: 'Expected JSON string',
        })
        return z.NEVER
      }

      return parsedJSON.data
    })

  export const file = () =>
    z.object({
      buffer: z.custom<Buffer>((value) => Buffer.isBuffer(value), {
        error: 'Expected a Buffer',
      }),
      encoding: z.string(),
      fieldname: z.string(),
      mimetype: z.string(),
      originalname: z.string(),
      size: z.number(),
    })

  export const parseDatabaseId = () => parseInteger().pipe(databaseId())
}
