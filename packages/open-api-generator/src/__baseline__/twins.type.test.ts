import { AssertTrue, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import type * as Catalog from './versioned-catalog.bag.js'
import type * as CatalogZod from './versioned-catalog.zod.js'
import type * as Multipart from './multipart-uploads.bag.js'
import type * as MultipartZod from './multipart-uploads.zod.js'
import type * as Variety from './type-variety.bag.js'
import type * as VarietyZod from './type-variety.zod.js'

type Twin<S extends z.ZodType, T> = IsExact<z.output<S>, T>

type _Catalog = AssertTrue<
  [
    Twin<typeof CatalogZod.ProductV1, Catalog.ProductV1>,
    Twin<typeof CatalogZod.ProductV2, Catalog.ProductV2>,
    Twin<typeof CatalogZod.Failure, Catalog.Failure>
  ] extends true[]
    ? true
    : false
>

type _Multipart = AssertTrue<
  [
    Twin<typeof MultipartZod.Upload, Multipart.Upload>,
    Twin<typeof MultipartZod.UploadFailure, Multipart.UploadFailure>
  ] extends true[]
    ? true
    : false
>

type _Variety = AssertTrue<
  [
    Twin<typeof VarietyZod.TreeNode, Variety.TreeNode>,
    Twin<typeof VarietyZod.TreeInput, Variety.TreeInput>,
    Twin<typeof VarietyZod.Circle, Variety.Circle>,
    Twin<typeof VarietyZod.Square, Variety.Square>,
    Twin<typeof VarietyZod.Drawing, Variety.Drawing>
  ] extends true[]
    ? true
    : false
>
