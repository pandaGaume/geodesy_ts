import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        ellipsoid: "src/ellipsoid.ts",
        system: "src/geodetic-system.ts",
    },
    format: ["esm"],
    target: "es2022",
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: true,
    treeshake: true,
});
