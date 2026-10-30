---
'@t-rest/supertest-adapter': minor
---

Versioned requests accept every version of the version history the server resolves to a declared route version, not only the declared versions themselves. The input and response types are those of the route the server executes, calls with a declared version type as before. A version older than every declared version of the route is still a type error, so the cast `'2024-01-01' as '2024-02-01'` is no longer needed for versions the server resolves.

```ts
// routes declared for '2024-01-01' and '2024-03-01'
await adapter.get('/items', '2024-02-01', { query: { page: '1' } }) // resolves to the route of '2024-01-01'
```
