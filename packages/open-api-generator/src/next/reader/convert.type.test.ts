import type { StandardJSONSchemaV1 } from '@standard-schema/spec'
import type { AssertTrue } from 'conditional-type-checks'
import type { StandardJSONSchemaSource } from './convert.js'

type _StandardJSONSchemaIsASource = AssertTrue<
  StandardJSONSchemaV1 extends StandardJSONSchemaSource ? true : false
>
