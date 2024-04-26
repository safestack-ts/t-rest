export const joinPath = (prefix: string, path: string) =>
  `/${prefix}/${path}`.replace(/(?<!:)\/{2,}/g, '/').replace(/\/$/, '')
