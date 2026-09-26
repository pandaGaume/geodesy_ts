# AGENTS.md, geodesy_ts

Read this file before modifying the repository.

## Scope

This repository publishes the renderer-neutral `@spacexr/geodesy` TypeScript package. It owns ellipsoids, geodetic coordinates, ECEF conversions and local tangent frames. It must not depend on Babylon.js, Three.js, 3D Tiles or application event systems.

## Conventions

- Prefix every TypeScript interface with an uppercase `I`.
- Document every public type, property and method with TSDoc/JSDoc.
- State angular units and axis conventions explicitly.
- Prefer explicit degree and radian methods over boolean unit switches.
- Keep calculations allocation-free when a caller supplies a target object.
- Never use the em dash character.

## Verification

Run `npm run check` before handing changes back. It formats, lints, type checks, tests, builds and generates the TypeDoc API documentation.
