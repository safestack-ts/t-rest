---
'@t-rest/core': patch
---

fix `ze` helpers to reject malformed input instead of throwing or partially parsing, keep `joinPath` root as `/`, and stop built bags of routes from sharing their builder's route map
