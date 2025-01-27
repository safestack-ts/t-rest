import { AssertTrue } from 'conditional-type-checks'
import { VersionHistory } from '../utils/version-history'
import { NewerVersions } from './newer-versions'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

type AfterOldestVersion = NewerVersions<typeof versionHistory, '2024-01-01'>
type AfterMiddleVersion = NewerVersions<typeof versionHistory, '2024-02-01'>
type AfterLatestVersion = NewerVersions<typeof versionHistory, '2024-03-01'>

type AfterOldestVersionIsCorrect = AfterOldestVersion extends
  | '2024-02-01'
  | '2024-03-01'
  ? true
  : false
type AfterMiddleVersionIsCorrect = AfterMiddleVersion extends '2024-03-01'
  ? true
  : false
type AfterLatestVersionIsCorrect = AfterLatestVersion extends never
  ? true
  : false

type _test =
  | AssertTrue<AfterOldestVersionIsCorrect>
  | AssertTrue<AfterMiddleVersionIsCorrect>
  | AssertTrue<AfterLatestVersionIsCorrect>
