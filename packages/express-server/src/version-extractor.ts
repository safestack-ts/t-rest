import { ExpressRequest } from "./express-type-shortcuts";

export interface VersionExtractor {
  extractVersion: (request: ExpressRequest) => string | undefined | null;
}

export interface DateVersionExtractor extends VersionExtractor {
  parseDate: (version: string) => Date;
}

export const isDateVersionExtractor = (
  versionExtrator: VersionExtractor
): versionExtrator is DateVersionExtractor => {
  return "parseDate" in versionExtrator;
};
