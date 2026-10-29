---
'@t-rest/open-api-generator': patch
---

Fix TypeScript to OpenAPI schema conversion: support native enums, keep generic type aliases intact, preserve nullability everywhere, emit valid nullable unions and tuples, type mixed literal unions correctly and avoid dangling `$ref`s from intersections, tuples and path params/headers
