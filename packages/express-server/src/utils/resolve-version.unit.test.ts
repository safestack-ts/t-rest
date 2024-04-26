import { DateVersionExtractor } from "../types/date-version-extractor";
import { resolveDateVersion, resolveVersion } from "./resolve-version";

const dateVersionHistory = [
  "2024-01-01",
  "2024-02-01",
  "2024-03-01",
  "2024-04-01",
  "2024-05-01",
];

describe("resolveVersion()", () => {
  test("should return requested version if it is available", () => {
    const availableVersions = ["2024-01-01", "2024-02-01", "2024-03-01"];
    const requestedVersion = "2024-02-01";
    const result = resolveVersion(
      dateVersionHistory,
      availableVersions,
      requestedVersion
    );
    expect(result).toBe(requestedVersion);
  });

  test("should return nearest lower version if requested version is not available", () => {
    const availableVersions = ["2024-01-01", "2024-02-01", "2024-03-01"];
    const requestedVersion = "2024-05-01";
    const result = resolveVersion(
      dateVersionHistory,
      availableVersions,
      requestedVersion
    );
    expect(result).toBe("2024-03-01");
  });

  test("should return null if no version is available", () => {
    const availableVersions = ["2024-01-01", "2024-02-01", "2024-03-01"];
    const requestedVersion = "2023-06-01";
    const result = resolveVersion(
      dateVersionHistory,
      availableVersions,
      requestedVersion
    );
    expect(result).toBeNull();
  });
});

describe("resolveDateVersion()", () => {
  const dateVersionExtractor: DateVersionExtractor = {
    extractVersion: () => "", // unused for these test cases
    parseDate: (version: string) => new Date(version),
  };

  test("should return requested version if it is available", () => {
    const availableVersions = ["2024-01-01", "2024-02-01", "2024-03-01"];
    const requestedVersion = "2024-02-01";
    const result = resolveDateVersion(
      dateVersionHistory,
      availableVersions,
      requestedVersion,
      dateVersionExtractor
    );
    expect(result).toBe(requestedVersion);
  });

  test("should return nearest lower version if requested version is not available", () => {
    const availableVersions = ["2024-01-01", "2024-02-01", "2024-03-01"];
    const requestedVersion = "2024-05-01";
    const result = resolveDateVersion(
      dateVersionHistory,
      availableVersions,
      requestedVersion,
      dateVersionExtractor
    );
    expect(result).toBe("2024-03-01");
  });

  test("should return nearest lower version if requested version is between two defined history versions", () => {
    const availableVersions = ["2024-01-01", "2024-02-01", "2024-03-01"];
    const requestedVersion = "2024-02-25";
    const result = resolveDateVersion(
      dateVersionHistory,
      availableVersions,
      requestedVersion,
      dateVersionExtractor
    );
    expect(result).toBe("2024-02-01");
  });

  test("should return null if no version is available", () => {
    const availableVersions = ["2024-01-01", "2024-02-01", "2024-03-01"];
    const requestedVersion = "2023-06-01";
    const result = resolveDateVersion(
      dateVersionHistory,
      availableVersions,
      requestedVersion,
      dateVersionExtractor
    );
    expect(result).toBeNull();
  });
});
