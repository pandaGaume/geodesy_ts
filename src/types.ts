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
