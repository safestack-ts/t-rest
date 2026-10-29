"use strict";
import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        include: ['src/**/*.{test,spec}.ts'],
        // *.type.test.ts files are compile-time checks, verified by `pnpm verify`
        exclude: ['**/node_modules/**', '**/dist/**', '**/*.type.test.ts'],
        environment: 'node',
        testTimeout: 60000,
        passWithNoTests: true,
    },
});
//# sourceMappingURL=vitest.base.config.mjs.map