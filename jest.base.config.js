/** @type {import('jest').Config} */
module.exports = {
  testRegex: '(?<!type)\\.(test|spec)\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-expect-message', 'jest-extended/all'],
  preset: 'ts-jest',
  // packages are ESM and import sources with .js specifiers
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 60000,
  ...(process.env.IS_CI === 'true'
    ? {
        workerThreads: true,
        workerIdleMemoryLimit: '50%',
        resetModules: true,
        maxWorkers: '50%',
      }
    : {}),
}
