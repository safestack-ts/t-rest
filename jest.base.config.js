/** @type {import('jest').Config} */
module.exports = {
  testRegex: ".*\\.(test|spec)\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  transform: { "^.+\\.ts$": ["ts-jest", { isolatedModules: true }] },
  testEnvironment: "node",
  setupFilesAfterEnv: ["jest-expect-message", "jest-extended/all"],
  preset: "ts-jest",
  testTimeout: 60000,
  ...(process.env.IS_CI === "true"
    ? {
        workerThreads: true,
        workerIdleMemoryLimit: "50%",
        resetModules: true,
        maxWorkers: "50%",
      }
    : {}),
};
