import { ExpressRequest } from "./express-type-shortcuts";

export interface VersionExtractor {
  extractVersion: (request: ExpressRequest) => string | undefined | null;
}
