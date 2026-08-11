export type DiscountCardRequirement = {
  system: string
  selectionGroupId: string
  selectionOwnerItemId: number
}

export type CheckoutItem = {
  id: number
  requiresDiscountCard: boolean
  discountCardRequirement: DiscountCardRequirement | null
}

export type Checkout = {
  id: number
  items: CheckoutItem[]
}
