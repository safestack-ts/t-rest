export const normalizePathPattern = (path: string) => {
  // express path param names may contain any word character, e.g. `:user_id`
  return path.replace(/:\w+/g, '%s')
}
