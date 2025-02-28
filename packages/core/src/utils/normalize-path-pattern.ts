export const normalizePathPattern = (path: string) => {
  return path.replace(/:[a-zA-Z0-9]+/g, '%s')
}
