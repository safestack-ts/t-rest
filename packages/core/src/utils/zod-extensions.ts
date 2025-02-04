import { ZodError, ZodType, z } from 'zod'

export namespace ze {
  // Refinements
  export const booleanString = () =>
    z.string().refine((value) => value === 'true' || value === 'false', {
      message: 'Expected boolean string',
    })

  export const numberString = () =>
    z.string().refine((value) => !isNaN(+value), {
      message: 'Expected number string',
    })

  export const integerString = () =>
    z.string().refine((value) => Number.isInteger(parseFloat(value)), {
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
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        return regex.test(value)
      },
      {
        message: 'Expected UUID string',
      }
    )

  export const jsonString = <T extends z.ZodTypeAny>(zodType: T) =>
    z.string().refine(
      (value) => {
        try {
          const parsedJSON = JSON.parse(value)
          zodType.parse(parsedJSON)
          return true
        } catch (err) {
          return false
        }
      },
      {
        message: 'Expected JSON string',
      }
    )

  export const jsonObject = <TOutputValue>(
    objectValidator: ZodType<TOutputValue, z.ZodTypeDef, unknown>
  ) =>
    z
      .string()
      .pipe(z.preprocess((value) => JSON.parse(String(value)), objectValidator))
      .or(objectValidator)

  export const databaseId = () => z.number().int().positive()

  export const parseInteger = (): z.ZodType<
    number,
    z.ZodTypeDef,
    number | string
  > =>
    z.union([
      z.number().int(),
      integerString().transform((value, ctx) => {
        const parsedValue = parseInt(value, 10)

        if (isNaN(parsedValue)) {
          throw new ZodError([
            {
              code: z.ZodIssueCode.custom,
              message: 'Expected parseable integer string',
              path: ctx.path,
            },
          ])
        }

        return parsedValue
      }),
    ])

  export const parseFloating = (): z.ZodType<
    number,
    z.ZodTypeDef,
    number | string
  > =>
    z.union([
      z.number(),
      z.string().transform((value, ctx) => {
        const parsedValue = parseFloat(value)

        if (isNaN(parsedValue)) {
          throw new ZodError([
            {
              code: z.ZodIssueCode.custom,
              message: 'Expected parseable floating number string',
              path: ctx.path,
            },
          ])
        }

        return parsedValue
      }),
    ])

  export const parseBoolean = (): z.ZodType<
    boolean,
    z.ZodTypeDef,
    boolean | string
  > =>
    z.union([
      z.boolean(),
      booleanString().transform((value) => value === 'true'),
    ])

  export const parseDate = () =>
    dateString()
      .transform((value) => new Date(value))
      .or(z.date())

  /*export const parseISO8601Date = (): z.ZodType<Date, z.ZodTypeDef, string | Date> =>
iso8601DateString()
  .transform((value) => parseISO(value))
  .or(z.date())*/

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
    z
      .string()
      .transform((value) => value.split(',').map((str) => parseInt(str, 10)))

  export const parseJSON = () =>
    z.string().transform((value) => JSON.parse(value))
}
