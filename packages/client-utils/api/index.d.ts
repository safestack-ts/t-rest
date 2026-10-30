import { BaseRequestInput as BaseRequestInput$1 } from '@t-rest/protocol';

/** @deprecated Use `BaseRequestInput` from `@t-rest/protocol`. */
type BaseRequestInput = BaseRequestInput$1;
/** @deprecated Use `buildUrl` from `@t-rest/protocol`. */
declare const buildUrl: (path: string, request?: BaseRequestInput$1) => string;

export { buildUrl };
export type { BaseRequestInput };
