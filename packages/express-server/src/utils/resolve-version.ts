export const resolveVersion = (
  versionHistory: string[],
  availableVersions: string[],
  requestedVersion: string
) => {
  if (availableVersions.includes(requestedVersion)) {
    return requestedVersion;
  }

  const requestedVersionIndex = versionHistory.indexOf(requestedVersion);

  for (let i = requestedVersionIndex - 1; i >= 0; i--) {
    const version = versionHistory[i];

    if (availableVersions.includes(version)) {
      return versionHistory[i];
    }
  }

  return null;
};
