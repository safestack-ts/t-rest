import { AssertTrue } from 'conditional-type-checks'
import { VersionHistory } from '../utils/version-history'
import { OlderVersions } from './older-versions'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

type BeforeLatestVersion = OlderVersions<typeof versionHistory, '2024-03-01'>
type BeforeMiddleVersion = OlderVersions<typeof versionHistory, '2024-02-01'>
type BeforeOldestVersion = OlderVersions<typeof versionHistory, '2024-01-01'>

type BeforeLatestVersionIsCorrect = BeforeLatestVersion extends
  | '2024-01-01'
  | '2024-02-01'
  ? true
  : false
type BeforeMiddleVersionIsCorrect = BeforeMiddleVersion extends '2024-01-01'
  ? true
  : false
type BeforeOldestVersionIsCorrect = BeforeOldestVersion extends []
  ? true
  : false

type _test =
  | AssertTrue<BeforeLatestVersionIsCorrect>
  | AssertTrue<BeforeMiddleVersionIsCorrect>
  | AssertTrue<BeforeOldestVersionIsCorrect>
