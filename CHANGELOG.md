# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

## [0.3.1] - 2026-10-29

### Added

- `LocalTangentPlane.enuPlaneToGeodeticRadians` and `enuPlaneToGeodeticDegrees`: the point at an ellipsoidal height on the vertical line of the origin through an east, north position, the inverse of projecting onto the tangent plane by dropping the up component.

## [0.3.0] - 2026-10-29

### Added

- `LambertConformalConicProjection`, the ellipsoidal Lambert conformal conic projection with one standard parallel and a scale factor (EPSG method 9801) or two standard parallels (EPSG method 9802), including southern cones.
- `WebMercatorProjection` (EPSG:3857), with `WEB_MERCATOR_RADIUS` and `WEB_MERCATOR_MAX_LATITUDE_DEGREES`.
- `IMapProjection`, implemented by every projection, to convert through a projection chosen at run time.
- `latitudeOfOriginRadians` option of `TransverseMercatorProjection`, counting northings from a parallel other than the equator (EPSG method 9807).

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
