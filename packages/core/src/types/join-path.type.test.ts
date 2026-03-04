import { AssertTrue, IsExact } from 'conditional-type-checks'
import { JoinPath } from './join-path.js'

type _test =
  | AssertTrue<IsExact<JoinPath<'/', '/a'>, '/a'>>
  | AssertTrue<IsExact<JoinPath<'/a', '/b'>, '/a/b'>>
  | AssertTrue<IsExact<JoinPath<'/a/', '/b'>, '/a/b'>>
  | AssertTrue<IsExact<JoinPath<'/a', '/b/'>, '/a/b'>>
