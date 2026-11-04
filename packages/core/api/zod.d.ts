export { z as ze } from './zod-extensions.js';
import { z } from 'zod';

/**
 * Gives every schema the id `<namespace>_<key>` in zod's global registry, dots
 * of the namespace become underscores, e.g. `V2024_01_01_Shared_Person` for
 * `defineModels('V2024_01_01.Shared', { Person })`. Generators name the schema
 * by this id. A schema that already has another id becomes an alias of it.
 *
 * Pass a schema to `defineModels` once and use the returned schema.
 */
declare const defineModels: <TModels extends Record<string, z.ZodType>>(namespace: string, models: TModels) => TModels;

export { defineModels };
