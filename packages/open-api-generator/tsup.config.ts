import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  tsconfig: "tsconfig.esm.json",
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  noExternal: ["lodash"],
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".js",
    };
  },
});
