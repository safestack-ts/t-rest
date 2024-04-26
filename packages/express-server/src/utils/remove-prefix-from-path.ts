export const removePrefixFromPath = (path: string, prefix: string) => {
  let newPath = path

  if (path.startsWith(prefix)) {
    newPath = path.slice(prefix.length)
  }

  if (!newPath.startsWith('/')) {
    newPath = `/${newPath}`
  }

  if (newPath.endsWith('/')) {
    newPath = newPath.slice(0, -1)
  }

  return newPath
}
