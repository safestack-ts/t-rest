// The only path param grammar: `:name` where name consists of word characters,
// e.g. `:user_id`. Express 5 syntax such as `{}` or `*splat` is not supported.
const PARAM_TOKEN = /:(\w+)/g

/** Names of the path params in positional order (`/a/:x/b/:y` -> `x`, `y`). */
export const pathParamNames = (path: string): string[] =>
  Array.from(path.matchAll(PARAM_TOKEN), (match) => match[1] as string)

/**
 * The version independent identity of a path: every param becomes `%s`, so
 * `/users/:id` and `/users/:userId` share one shape.
 */
export const pathShape = (path: string): string =>
  path.replace(PARAM_TOKEN, '%s')

/**
 * Replaces every `:name` placeholder in `path` whose name is a key of `params`
 * with the URL-encoded param value. Placeholders are matched by their whole
 * name, so `:id` never matches inside `:idx`. Placeholders without a param
 * are left untouched.
 */
export const fillPathParams = (
  path: string,
  params: Record<string, unknown> = {}
): string =>
  path.replace(PARAM_TOKEN, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key)
      ? encodeURIComponent(String(params[key]))
      : placeholder
  )

/**
 * Joins a prefix and a path to one absolute path: duplicate slashes are
 * collapsed (except in `://`) and the trailing slash is removed unless the
 * result is the root path.
 */
export const joinPaths = (prefix: string, path: string): string =>
  `/${prefix}/${path}`.replace(/(?<!:)\/{2,}/g, '/').replace(/(?<=.)\/$/, '')
