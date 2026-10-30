---
'@t-rest/supertest-adapter': minor
---

Rename the stateless `VersionInjector` to `SupertestVersionInjector`, so it no longer shares its name with the `VersionInjector` of `@t-rest/client`. `VersionInjector` stays exported as a deprecated alias (value and type), existing code keeps working.

```ts
// before
class HeaderInjector extends VersionInjector {}
// after
class HeaderInjector extends SupertestVersionInjector {}
```
