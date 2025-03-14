import { z } from 'zod'

// Intermediate type system representation
export const validateTypeKind = z.enum([
  'string',
  'number',
  'boolean',
  'null',
  'array',
  'object',
  'union',
  'intersection',
  'literal',
  'date',
  'enum',
])
export type TypeKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'array'
  | 'object'
  | 'union'
  | 'intersection'
  | 'literal'
  | 'date'
  | 'enum'
  | 'buffer'
  | 'bigint'
  | 'symbol'
  | 'map'
  | 'set'
  | 'regexp'
  | 'stream'

const validateBaseType: z.ZodType<BaseType> = z.object({
  description: z.string().optional(),
  deprecated: z.boolean().optional(),
})
interface BaseType {
  description?: string
  deprecated?: boolean
}

export const validateStringType: z.ZodType<StringType> = validateBaseType.and(
  z.object({
    kind: z.literal('string'),
    format: z.enum(['date-time', 'date', 'email', 'uuid']).optional(),
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
  })
)
export interface StringType extends BaseType {
  kind: 'string'
  format?: 'date-time' | 'date' | 'email' | 'uuid'
  pattern?: string
  minLength?: number
  maxLength?: number
}

export const StringType = (args?: Omit<StringType, 'kind'>): StringType => ({
  kind: 'string',
  ...args,
})

export const validateNumberType: z.ZodType<NumberType> = validateBaseType.and(
  z.object({
    kind: z.literal('number'),
    format: z.enum(['float', 'double', 'int32', 'int64']).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    multipleOf: z.number().optional(),
  })
)
export interface NumberType extends BaseType {
  kind: 'number'
  format?: 'float' | 'double' | 'int32' | 'int64'
  minimum?: number
  maximum?: number
  multipleOf?: number
}

export const NumberType = (args?: Omit<NumberType, 'kind'>): NumberType => ({
  kind: 'number',
  ...args,
})

export const validateBooleanType: z.ZodType<BooleanType> = validateBaseType.and(
  z.object({
    kind: z.literal('boolean'),
  })
)
export interface BooleanType extends BaseType {
  kind: 'boolean'
}

export const BooleanType = (args?: Omit<BooleanType, 'kind'>): BooleanType => ({
  kind: 'boolean',
  ...args,
})

export const validateNullType: z.ZodType<NullType> = validateBaseType.and(
  z.object({
    kind: z.literal('null'),
  })
)
export interface NullType extends BaseType {
  kind: 'null'
}

export const NullType = (args?: Omit<NullType, 'kind'>): NullType => ({
  kind: 'null',
  ...args,
})

export const validateArrayType: z.ZodType<ArrayType> = validateBaseType.and(
  z.object({
    kind: z.literal('array'),
    items: z.lazy(() => validateTypeDefinition),
    minItems: z.number().optional(),
    maxItems: z.number().optional(),
    uniqueItems: z.boolean().optional(),
  })
)
export interface ArrayType extends BaseType {
  kind: 'array'
  items: TypeDefinition
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
}

export const ArrayType = (args: Omit<ArrayType, 'kind'>): ArrayType => ({
  kind: 'array',
  ...args,
})

export const validateObjectType: z.ZodType<ObjectType> = validateBaseType.and(
  z.object({
    kind: z.literal('object'),
    originalName: z.string().optional(),
    properties: z.record(z.lazy(() => validateTypeDefinition)),
    required: z.array(z.string()).optional(),
    additionalProperties: z
      .union([z.boolean(), z.lazy(() => validateTypeDefinition)])
      .optional(),
    minProperties: z.number().optional(),
    maxProperties: z.number().optional(),
  })
)
export interface ObjectType extends BaseType {
  kind: 'object'
  originalName?: string
  properties: Record<string, TypeDefinition>
  required?: string[]
  additionalProperties?: boolean | TypeDefinition
  minProperties?: number
  maxProperties?: number
}

export const ObjectType = (args: Omit<ObjectType, 'kind'>): ObjectType => ({
  kind: 'object',
  ...args,
})

export const validateRecordType: z.ZodType<RecordType> = validateBaseType.and(
  z.object({
    kind: z.literal('record'),
    value: z.lazy(() => validateTypeDefinition),
  })
)

export interface RecordType extends BaseType {
  kind: 'record'
  value: TypeDefinition
}

export const RecordType = (args: Omit<RecordType, 'kind'>): RecordType => ({
  kind: 'record',
  ...args,
})

export const validateUnionType: z.ZodType<UnionType> = validateBaseType.and(
  z.object({
    kind: z.literal('union'),
    types: z.array(z.lazy(() => validateTypeDefinition)),
  })
)
export interface UnionType extends BaseType {
  kind: 'union'
  types: TypeDefinition[]
}

export const UnionType = (args: Omit<UnionType, 'kind'>): UnionType => ({
  kind: 'union',
  ...args,
})

export const validateIntersectionType: z.ZodType<IntersectionType> =
  validateBaseType.and(
    z.object({
      kind: z.literal('intersection'),
      types: z.array(z.lazy(() => validateTypeDefinition)),
    })
  )
export interface IntersectionType extends BaseType {
  kind: 'intersection'
  types: TypeDefinition[]
}

export const IntersectionType = (
  args: Omit<IntersectionType, 'kind'>
): IntersectionType => ({
  kind: 'intersection',
  ...args,
})

export const validateLiteralType: z.ZodType<LiteralType> = validateBaseType.and(
  z.object({
    kind: z.literal('literal'),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })
)
export interface LiteralType extends BaseType {
  kind: 'literal'
  value: string | number | boolean
}

export const LiteralType = (args: Omit<LiteralType, 'kind'>): LiteralType => ({
  kind: 'literal',
  ...args,
})

export const validateDateType: z.ZodType<DateType> = validateBaseType.and(
  z.object({
    kind: z.literal('date'),
  })
)
export interface DateType extends BaseType {
  kind: 'date'
}

export const DateType = (args?: Omit<DateType, 'kind'>): DateType => ({
  kind: 'date',
  ...args,
})

export const validateBufferType: z.ZodType<BufferType> = validateBaseType.and(
  z.object({
    kind: z.literal('buffer'),
  })
)
export interface BufferType extends BaseType {
  kind: 'buffer'
}

export const BufferType = (args?: Omit<BufferType, 'kind'>): BufferType => ({
  kind: 'buffer',
  ...args,
})

export const validateBigIntType: z.ZodType<BigIntType> = validateBaseType.and(
  z.object({
    kind: z.literal('bigint'),
  })
)
export interface BigIntType extends BaseType {
  kind: 'bigint'
}

export const BigIntType = (args?: Omit<BigIntType, 'kind'>): BigIntType => ({
  kind: 'bigint',
  ...args,
})

export const validateSymbolType: z.ZodType<SymbolType> = validateBaseType.and(
  z.object({
    kind: z.literal('symbol'),
  })
)
export interface SymbolType extends BaseType {
  kind: 'symbol'
}

export const SymbolType = (args?: Omit<SymbolType, 'kind'>): SymbolType => ({
  kind: 'symbol',
  ...args,
})

export const validateMapType: z.ZodType<MapType> = validateBaseType.and(
  z.object({
    kind: z.literal('map'),
  })
)
export interface MapType extends BaseType {
  kind: 'map'
}

export const MapType = (args?: Omit<MapType, 'kind'>): MapType => ({
  kind: 'map',
  ...args,
})

export const validateSetType: z.ZodType<SetType> = validateBaseType.and(
  z.object({
    kind: z.literal('set'),
  })
)
export interface SetType extends BaseType {
  kind: 'set'
}

export const SetType = (args?: Omit<SetType, 'kind'>): SetType => ({
  kind: 'set',
  ...args,
})

export const validateRegexpType: z.ZodType<RegexpType> = validateBaseType.and(
  z.object({
    kind: z.literal('regexp'),
  })
)
export interface RegexpType extends BaseType {
  kind: 'regexp'
}

export const RegexpType = (args?: Omit<RegexpType, 'kind'>): RegexpType => ({
  kind: 'regexp',
  ...args,
})

export const validateStreamType: z.ZodType<StreamType> = validateBaseType.and(
  z.object({
    kind: z.literal('stream'),
  })
)
export interface StreamType extends BaseType {
  kind: 'stream'
}

export const StreamType = (args?: Omit<StreamType, 'kind'>): StreamType => ({
  kind: 'stream',
  ...args,
})

export const validateEnumType: z.ZodType<EnumType> = validateBaseType.and(
  z.object({
    kind: z.literal('enum'),
    values: z.array(z.union([z.string(), z.number()])),
    type: z.enum(['string', 'number']),
    name: z.string(),
  })
)
export interface EnumType extends BaseType {
  kind: 'enum'
  values: (string | number)[]
  type: 'string' | 'number'
  name: string
}

export const EnumType = (args: Omit<EnumType, 'kind'>): EnumType => ({
  kind: 'enum',
  ...args,
})

export const validateTypeDefinition: z.ZodType<TypeDefinition> = z
  .object({
    originalName: z.string().optional(),
    typeParameters: z.record(z.lazy(() => validateTypeDefinition)).optional(),
  })
  .and(
    z.union([
      validateStringType,
      validateNumberType,
      validateBooleanType,
      validateNullType,
      validateArrayType,
      validateObjectType,
      validateRecordType,
      validateUnionType,
      validateIntersectionType,
      validateLiteralType,
      validateDateType,
      validateEnumType,
      validateBufferType,
      validateBigIntType,
      validateSymbolType,
      validateMapType,
      validateSetType,
      validateRegexpType,
      validateStreamType,
    ])
  )

export type TypeDefinition = {
  name?: string
  typeParameters?: Record<string, TypeDefinition>
  nullable?: boolean
} & (
  | StringType
  | NumberType
  | BooleanType
  | ObjectType
  | RecordType
  | NullType
  | ArrayType
  | UnionType
  | IntersectionType
  | LiteralType
  | DateType
  | EnumType
  | BufferType
  | BigIntType
  | SymbolType
  | MapType
  | SetType
  | RegexpType
  | StreamType
  | {
      kind: 'generic'
      name: string
      structure: TypeDefinition
    }
  | { kind: 'ref'; name: string }
  | { kind: 'any' }
  | { kind: 'unknown' }
)
