import { AssertTrue, IsExact } from 'conditional-type-checks'
import { PathParamsMatchingRouteValidator } from './path-params-matching-route-validator'
import { z } from 'zod'
import { AnyRouteValidator } from './any-route-validator'

// single param
type _path_with_one_param_requires_validator_for_param = AssertTrue<
  IsExact<
    z.ZodObject<{
      params: z.ZodObject<{ userId: z.ZodType<string | number> }>
      query?: z.ZodObject<any>
      body?: z.ZodObject<any>
      headers?: z.ZodObject<any>
    }> extends PathParamsMatchingRouteValidator<'/users/:userId'>
      ? true
      : false,
    true
  >
>

const _validatorFuncSingle =
  <TPath extends string>(_path: TPath) =>
  <TValidator extends PathParamsMatchingRouteValidator<TPath>>(
    _validator: TValidator
  ) =>
    undefined

_validatorFuncSingle('/users/:userId')(
  z.object({ params: z.object({ userId: z.string() }) })
)
_validatorFuncSingle('/users/:userId')(
  // @ts-expect-error
  z.object({ params: z.object({ userIds: z.string() }) })
)

// multiple params
type _path_with_multiple_params_requires_validator_for_each_param = AssertTrue<
  IsExact<
    z.ZodObject<{
      params: z.ZodObject<{
        userId: z.ZodType<string | number>
        commentId: z.ZodType<string | number>
      }>
      query?: z.ZodObject<any>
      body?: z.ZodObject<any>
      headers?: z.ZodObject<any>
    }> extends PathParamsMatchingRouteValidator<'/users/:userId/comments/:commentId'>
      ? true
      : false,
    true
  >
>

const _validatorFuncMultiple =
  <TPath extends string>(_path: TPath) =>
  <TValidator extends PathParamsMatchingRouteValidator<TPath>>(
    _validator: TValidator
  ) =>
    undefined

_validatorFuncMultiple('/users/:userId/comments/:commentId')(
  z.object({ params: z.object({ userId: z.string(), commentId: z.string() }) })
)

_validatorFuncMultiple('/users/:userId/comments/:commentId')(
  // @ts-expect-error
  z.object({ params: z.object({ userId: z.string() }) })
)

// param validator with extra fields is still compatible
type _path_with_extra_fields_in_param_validator_is_still_compatible =
  AssertTrue<
    IsExact<
      z.ZodObject<{
        params: z.ZodObject<{
          userId: z.ZodType<string | number>
          extraField: z.ZodType<boolean>
        }>
      }> extends PathParamsMatchingRouteValidator<'/users/:userId'>
        ? true
        : false,
      true
    >
  >

// missing param validator is not compatible
type _path_with_missing_param_validator_is_not_compatible = AssertTrue<
  IsExact<
    z.ZodObject<{
      params: z.ZodObject<{ otherProp: z.ZodType<string | number> }>
    }> extends PathParamsMatchingRouteValidator<'/users/:userId'>
      ? true
      : false,
    false // should be false
  >
>

_validatorFuncMultiple('/users/:userId')(
  // @ts-expect-error
  z.object({ params: z.object({ otherProp: z.string() }) })
)

// if no params, no params validator is required
type _path_with_no_params_does_not_require_params_validator = AssertTrue<
  IsExact<
    PathParamsMatchingRouteValidator<'/users'> extends AnyRouteValidator
      ? true
      : false,
    true
  >
>
