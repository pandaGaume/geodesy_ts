# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

## [0.2.0] - 2026-10-05

### Added

- `TransverseMercatorProjection`, an ellipsoidal transverse Mercator projection using the sixth-order Kruger series, with forward and inverse conversions in degrees or radians.
- `UtmProjection`, `utmCentralMeridianDegrees` and `utmZoneFromDegrees`, including the Norway and Svalbard zone exceptions.
- `IProjectedCoordinates` for easting and northing values in metres.

## [0.1.0] - 2026-10-05

### Added

- Initial `@spacexr/geodesy` package.
- Immutable reference ellipsoids, including WGS84, GRS80, GRS67, ANS, WGS72 and Clarke presets.
- Geodetic, ECEF, ENU and NED coordinate conversions.
- Canonical `ILocalTangentBasis` with symmetric ENU and NED transformation matrices.
- JSDoc-compatible TSDoc API documentation and TypeDoc generation.
- Continuous integration and npm trusted publishing release workflow with provenance.
