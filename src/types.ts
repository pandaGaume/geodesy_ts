/**
 * Mutable three-dimensional Cartesian coordinate.
 *
 * Axis meaning depends on the coordinate system that produces the value. ECEF
 * uses metres along the conventional Earth-fixed X, Y and Z axes. ENU uses
 * metres along east, north and up. NED uses metres along north, east and down.
 */
export interface ICartesian3 {
    /** First Cartesian component in metres. */
    x: number;
    /** Second Cartesian component in metres. */
    y: number;
    /** Third Cartesian component in metres. */
    z: number;
}

/**
 * Mutable geodetic coordinate on a reference ellipsoid.
 *
 * The angular unit is determined by the method returning or accepting the
 * object. Methods are explicitly suffixed with `Degrees` or `Radians`.
 */
export interface IGeodeticCoordinates {
    /** Geodetic latitude, not geocentric latitude. */
    latitude: number;
    /** Longitude east of the reference meridian. */
    longitude: number;
    /** Ellipsoidal height in metres. */
    height: number;
}

/**
 * Canonical local tangent basis expressed as ECEF unit vectors.
 *
 * The basis describes physical directions independently from a coordinate
 * convention. ENU orders it as east, north, up. NED orders it as north, east,
 * down, where down is the opposite of up.
 */
export interface ILocalTangentBasis {
    /** Unit vector pointing east. */
    east: ICartesian3;
    /** Unit vector pointing north. */
    north: ICartesian3;
    /** Unit vector normal to the ellipsoid and pointing up. */
    up: ICartesian3;
}

/**
 * Mutable projected map coordinate.
 *
 * Eastings increase toward the east and northings toward the north. Both are
 * expressed in metres and include any false easting or false northing.
 */
export interface IProjectedCoordinates {
    /** Easting in metres. */
    easting: number;
    /** Northing in metres. */
    northing: number;
}

/**
 * Conversion between geodetic coordinates and the eastings and northings of a map projection.
 *
 * Every projection of the package implements it, so a caller can hold any of
 * them, for example a coordinate reference system chosen at run time. Results
 * include the false easting and false northing of the projection.
 */
export interface IMapProjection {
    /**
     * Projects geodetic coordinates in radians.
     *
     * @param latitudeRadians - Geodetic latitude in radians.
     * @param longitudeRadians - Longitude in radians east of the reference meridian.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with easting and northing in metres.
     */
    geodeticRadiansToProjected(latitudeRadians: number, longitudeRadians: number, target?: IProjectedCoordinates): IProjectedCoordinates;
    /**
     * Projects geodetic coordinates in degrees.
     *
     * @param latitudeDegrees - Geodetic latitude in degrees.
     * @param longitudeDegrees - Longitude in degrees east of the reference meridian.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with easting and northing in metres.
     */
    geodeticDegreesToProjected(latitudeDegrees: number, longitudeDegrees: number, target?: IProjectedCoordinates): IProjectedCoordinates;
    /**
     * Converts projected coordinates to geodetic coordinates in radians.
     *
     * @param easting - Easting in metres, including the false easting.
     * @param northing - Northing in metres, including the false northing.
     * @param height - Ellipsoidal height in metres copied to the result. Defaults to 0.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with geodetic latitude and longitude in radians, longitude normalized to `[-PI, PI)`.
     */
    projectedToGeodeticRadians(easting: number, northing: number, height?: number, target?: IGeodeticCoordinates): IGeodeticCoordinates;
    /**
     * Converts projected coordinates to geodetic coordinates in degrees.
     *
     * @param easting - Easting in metres, including the false easting.
     * @param northing - Northing in metres, including the false northing.
     * @param height - Ellipsoidal height in metres copied to the result. Defaults to 0.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with geodetic latitude and longitude in degrees, longitude normalized to `[-180, 180)`.
     */
    projectedToGeodeticDegrees(easting: number, northing: number, height?: number, target?: IGeodeticCoordinates): IGeodeticCoordinates;
}
