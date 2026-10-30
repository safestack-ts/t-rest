---
'@t-rest/client-utils': patch
---

buildUrl: replace path params by whole name (all occurrences) and URL-encode them; omit null query values. Query arrays keep being serialized as JSON (`ids=[1,2]`, an empty array as `[]`), so servers parsing them with a JSON query validator such as `ze.jsonObject` keep working.
