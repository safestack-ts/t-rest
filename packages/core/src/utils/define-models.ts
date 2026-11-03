import { z } from 'zod'

const modelIdPattern = /^[A-Za-z0-9_]+$/

const withModelId = (schema: z.ZodType, id: string): z.ZodType => {
  const meta = z.globalRegistry.get(schema)

  if (meta?.id === undefined) {
    // in place, so schemas that already nest this one reference it by its id
    return schema.register(z.globalRegistry, { ...meta, id })
  }

  return meta.id === id ? schema : schema.meta({ id })
}

/**
 * Gives every schema the id `<namespace>_<key>` in zod's global registry, dots
 * of the namespace become underscores, e.g. `V2024_01_01_Shared_Person` for
 * `defineModels('V2024_01_01.Shared', { Person })`. Generators name the schema
 * by this id. A schema that already has another id becomes an alias of it.
 *
 * Pass a schema to `defineModels` once and use the returned schema.
 */
export const defineModels = <TModels extends Record<string, z.ZodType>>(
  namespace: string,
  models: TModels
): TModels => {
  const identified = Object.entries(models).map(([key, schema]) => {
    const id = `${namespace.replace(/\./g, '_')}_${key}`

    if (!modelIdPattern.test(id)) {
      throw new Error(
        `The model id "${id}" may only contain letters, digits and underscores`
      )
    }

    return [key, schema, id] as const
  })

  return Object.fromEntries(
    identified.map(([key, schema, id]) => [key, withModelId(schema, id)])
  ) as TModels
}
