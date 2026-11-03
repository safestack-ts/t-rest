---
'@t-rest/client': major
---

`AxiosHTTPAdapter` moved from the package root to the `@t-rest/client/axios` subpath, so the root entry no longer references the types of the optional `axios` peer dependency. TypeScript users without axios no longer get type errors when importing `@t-rest/client`. Update your imports:

```ts
// before
import { AxiosHTTPAdapter, RESTClient } from '@t-rest/client'
// after
import { RESTClient } from '@t-rest/client'
import { AxiosHTTPAdapter } from '@t-rest/client/axios'
```
