# @t-rest/client-utils

> **Deprecated.** Use [`@t-rest/protocol`](https://www.npmjs.com/package/@t-rest/protocol) instead. This is the final release of this package, it will not be part of t-rest 1.0.0.

`@t-rest/client-utils` only re-exports `buildUrl` and `BaseRequestInput` from `@t-rest/protocol`, with unchanged behaviour and types.

## Migration

Swap the dependency:

```sh
npm uninstall @t-rest/client-utils
npm install @t-rest/protocol
```

Update the import:

```diff
- import { buildUrl, type BaseRequestInput } from '@t-rest/client-utils'
+ import { buildUrl, type BaseRequestInput } from '@t-rest/protocol'
```
