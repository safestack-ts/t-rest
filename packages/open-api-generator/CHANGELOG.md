# @t-rest/open-api-generator

## 1.0.0-alpha.44

### Patch Changes

- Updated dependencies [c319eb0]
  - @t-rest/core@1.0.0-alpha.20

## 1.0.0-alpha.43

### Patch Changes

- Updated dependencies [3bcede0]
  - @t-rest/core@1.0.0-alpha.19

## 1.0.0-alpha.42

### Patch Changes

- d58c11b: fix open api schema generation ref handling in arrays and tuples

## 1.0.0-alpha.41

### Patch Changes

- b42e529: fix array handling of single ref items

## 1.0.0-alpha.40

### Patch Changes

- aee69fa: fix handling of union types consisting out of arrays

## 1.0.0-alpha.39

### Patch Changes

- b48f6de: fix tuple detection in complex structure like mixtures of intersection and union types

## 1.0.0-alpha.38

### Patch Changes

- 372372f: increment version

## 1.0.0-alpha.37

### Patch Changes

- 60f992f: avoid duplicate header definitions on routes when merging local and global headers

## 1.0.0-alpha.36

### Patch Changes

- 15055bd: bump version

## 1.0.0-alpha.35

### Patch Changes

- 924bc29: export OpenAPIMetaData type

## 1.0.0-alpha.34

### Patch Changes

- 2a390bd: fix additional meta field compiling

## 1.0.0-alpha.33

### Patch Changes

- 67a6e7a: support detection of empty array

## 1.0.0-alpha.32

### Patch Changes

- d59ae9b: fix detection of nullable and optional properties

## 1.0.0-alpha.31

### Patch Changes

- 66c53fe: fix name tracking of recursive interface types

## 1.0.0-alpha.30

### Patch Changes

- 744a809: fix open api spec yaml path param schema
- 252aaa3: add ast parsing test case setup; fix handling of Omit/Pick and zods branded types

## 1.0.0-alpha.29

### Patch Changes

- a600465: fix handling of recursive interfaces

## 1.0.0-alpha.28

### Patch Changes

- 4263092: fix alpha release process build esm version
- Updated dependencies [4263092]
  - @t-rest/core@1.0.0-alpha.18

## 1.0.0-alpha.27

### Patch Changes

- fbed986: increment version of all packages
- Updated dependencies [fbed986]
  - @t-rest/core@1.0.0-alpha.17

## 1.0.0-alpha.26

### Patch Changes

- e4f7501: fix filter metaData argument

## 1.0.0-alpha.25

### Patch Changes

- eb762ab: resolve components in query params

## 1.0.0-alpha.24

### Patch Changes

- 29fb852: normalize route paths
- a0e7da7: support filtering
- Updated dependencies [29fb852]
  - @t-rest/core@1.0.0-alpha.16

## 1.0.0-alpha.23

### Patch Changes

- 0e4422d: sort schema components alphabetically & support detection of records
- Updated dependencies [0e4422d]
  - @t-rest/core@1.0.0-alpha.15

## 1.0.0-alpha.22

### Patch Changes

- fc48b4a: fix handling of null in open api 3.0
- 18f8020: fix handling of unnamed intersection types

## 1.0.0-alpha.21

### Patch Changes

- 67f3eaa: fix handling of union which include primitives
- Updated dependencies [67f3eaa]
  - @t-rest/core@1.0.0-alpha.14

## 1.0.0-alpha.20

### Patch Changes

- bf34b7e: add type handling of build in types

## 1.0.0-alpha.19

### Patch Changes

- 6c2d54d: extending AST parsing to handle generics, handle recursive types and generating object schemas

## 1.0.0-alpha.18

### Patch Changes

- 7a5c5d7: add debug package with basic debug logs

## 1.0.0-alpha.17

### Patch Changes

- Updated dependencies [7586764]
  - @t-rest/core@1.0.0-alpha.13

## 1.0.0-alpha.16

### Patch Changes

- Updated dependencies [88d2156]
  - @t-rest/core@1.0.0-alpha.12

## 1.0.0-alpha.15

### Patch Changes

- Updated dependencies [cc7eaae]
  - @t-rest/core@1.0.0-alpha.11

## 1.0.0-alpha.14

### Patch Changes

- Updated dependencies [242e7fc]
  - @t-rest/core@1.0.0-alpha.10

## 1.0.0-alpha.13

### Patch Changes

- Updated dependencies [55efe76]
  - @t-rest/core@1.0.0-alpha.9

## 1.0.0-alpha.12

### Patch Changes

- Updated dependencies [7b357b9]
  - @t-rest/core@1.0.0-alpha.8

## 1.0.0-alpha.11

### Patch Changes

- Updated dependencies [98fce5d]
  - @t-rest/core@1.0.0-alpha.7

## 1.0.0-alpha.10

### Patch Changes

- Updated dependencies
  - @t-rest/core@1.0.0-alpha.6

## 1.0.0-alpha.9

### Patch Changes

- Updated dependencies
  - @t-rest/core@1.0.0-alpha.5

## 1.0.0-alpha.8

### Patch Changes

- add exports property to package.json
- Updated dependencies
  - @t-rest/core@1.0.0-alpha.4

## 1.0.0-alpha.7

### Patch Changes

- fix esm build setup
- Updated dependencies
  - @t-rest/core@1.0.0-alpha.3

## 1.0.0-alpha.6

### Minor Changes

- esm build support

### Patch Changes

- Updated dependencies
  - @t-rest/core@1.0.0-alpha.2

## 1.0.0-alpha.5

### Patch Changes

- fba228b: fix parsing of boolean values

## 1.0.0-alpha.4

### Patch Changes

- inc version

## 1.0.0-alpha.3

### Patch Changes

- inc version

## 1.0.0-alpha.2

### Patch Changes

- first version of open api spec generator
- Updated dependencies
  - @t-rest/core@1.0.0-alpha.1
