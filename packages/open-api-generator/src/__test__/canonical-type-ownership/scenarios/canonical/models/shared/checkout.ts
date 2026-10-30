export interface PromoCodeValid {
  valid: true
  code: string
}

export interface PromoCodeInvalid {
  valid: false
  code: string
}

export type PromoCode = PromoCodeValid | PromoCodeInvalid
