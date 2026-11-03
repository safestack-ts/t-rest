export interface VendorPolicy {
  /** `trust`: `$defs` keys are author ids. `inline`: every def is structure only. */
  readonly defs: 'trust' | 'inline'
  /** `$defs` keys the library generates itself; never author ids. */
  readonly generatedKeys?: RegExp
  /** Library options for the retry after a strict conversion threw. */
  readonly lenientOptions?: Readonly<Record<string, unknown>>
  /** `integer` bounds of ±`Number.MAX_SAFE_INTEGER` come from the library, not the author. */
  readonly safeIntegers: boolean
}

/** The only vendor knowledge in the generator, keyed by `~standard.vendor`. */
export const VENDOR_POLICIES: Readonly<Record<string, VendorPolicy>> = {
  zod: {
    defs: 'trust',
    generatedKeys: /^__schema\d+$/,
    lenientOptions: { unrepresentable: 'any' },
    safeIntegers: true,
  },
  valibot: { defs: 'trust', safeIntegers: false },
  arktype: { defs: 'inline', safeIntegers: false },
  't-rest': { defs: 'trust', safeIntegers: false },
}

const UNKNOWN_VENDOR: VendorPolicy = { defs: 'inline', safeIntegers: false }
const TRUSTED_UNKNOWN_VENDOR: VendorPolicy = {
  defs: 'trust',
  safeIntegers: false,
}

export const vendorPolicy = (
  vendor: string,
  trustedVendors: readonly string[]
): VendorPolicy =>
  VENDOR_POLICIES[vendor] ??
  (trustedVendors.includes(vendor) ? TRUSTED_UNKNOWN_VENDOR : UNKNOWN_VENDOR)
