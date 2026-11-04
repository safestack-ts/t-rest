import { requireModelId } from './require-model-id.js'

export const plugin = {
  meta: { name: 't-rest' },
  rules: { 'require-model-id': requireModelId },
} as const
