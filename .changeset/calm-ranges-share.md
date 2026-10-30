---
'@t-rest/core': patch
'@t-rest/client': patch
'@t-rest/client-utils': patch
'@t-rest/express-server': patch
'@t-rest/supertest-adapter': patch
'@t-rest/open-api-generator': patch
---

Internal `@t-rest` dependencies are now published as caret ranges (`workspace:^`), reducing duplicate copies of the packages in consumers' dependency trees.
