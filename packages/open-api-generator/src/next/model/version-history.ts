/** One entry per breaking change of the `ApiModelDocument` format, oldest first. */
export const MODEL_VERSION_HISTORY = [
  {
    version: 1,
    changes: ['Initial format.'],
  },
] as const

type Last<T extends readonly unknown[]> = T extends readonly [
  ...unknown[],
  infer L
]
  ? L
  : never

export type ModelVersion = Last<typeof MODEL_VERSION_HISTORY>['version']

export const MODEL_VERSION = (
  MODEL_VERSION_HISTORY[MODEL_VERSION_HISTORY.length - 1] as Last<
    typeof MODEL_VERSION_HISTORY
  >
).version
