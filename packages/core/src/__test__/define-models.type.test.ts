import { AssertTrue, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import { defineModels } from '../zod.js'

const Person = z.object({ name: z.string(), age: z.number().optional() })
const Status = z.enum(['active', 'archived'])

const models = defineModels('Shared', { Person, Status })

type _sameKeysAndTypes = AssertTrue<
  IsExact<typeof models, { Person: typeof Person; Status: typeof Status }>
>

// @ts-expect-error models are zod schemas
defineModels('Shared', { Person: { name: 'x' } })
