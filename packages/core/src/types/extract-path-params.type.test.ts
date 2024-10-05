import { AssertTrue, IsExact } from 'conditional-type-checks'
import { ExtractPathParams } from './extract-path-params'

type _single_param_is_extracted = AssertTrue<
  IsExact<ExtractPathParams<'/users/:userId'>, { userId: string | number }>
>

type _multiple_params_are_extracted = AssertTrue<
  IsExact<
    ExtractPathParams<'/users/:userId/comments/:commentId'>,
    { userId: string | number; commentId: string | number }
  >
>

type _path_without_params_returns_empty_object = AssertTrue<
  IsExact<ExtractPathParams<'/users'>, {}>
>
