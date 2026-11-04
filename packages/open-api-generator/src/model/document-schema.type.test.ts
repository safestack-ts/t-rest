import { AssertTrue, IsExact } from 'conditional-type-checks'
import type { ApiModelDocument, Unbranded } from './document-schema.js'
import type { ApiModel, ComponentName } from './types.js'

type _PipelineMatchesDocument = AssertTrue<
  IsExact<Unbranded<ApiModel<ComponentName>>, ApiModelDocument>
>
