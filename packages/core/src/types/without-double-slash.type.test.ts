import { WithoutDoubleSlash } from './without-double-slash'
import { AssertTrue, IsExact } from 'conditional-type-checks'

type DoubleSlashAtBeginning = '//users'
type DoubleSlashAtEnd = 'users//'
type DoubleSlashInMiddle = 'users//posts'
type RootDoubleSlash = '//'

type WithoutDoubleSlashAtBeginning = WithoutDoubleSlash<DoubleSlashAtBeginning>
type WithoutDoubleSlashAtEnd = WithoutDoubleSlash<DoubleSlashAtEnd>
type WithoutDoubleSlashInMiddle = WithoutDoubleSlash<DoubleSlashInMiddle>
type WithoutRootDoubleSlash = WithoutDoubleSlash<RootDoubleSlash>

type _test =
  | AssertTrue<IsExact<WithoutDoubleSlashAtBeginning, '/users'>>
  | AssertTrue<IsExact<WithoutDoubleSlashAtEnd, 'users/'>>
  | AssertTrue<IsExact<WithoutDoubleSlashInMiddle, 'users/posts'>>
  | AssertTrue<IsExact<WithoutRootDoubleSlash, '/'>>
