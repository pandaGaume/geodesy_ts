/**
 * Immutable oblate ellipsoid of revolution.
 *
 * Axis lengths are expressed in metres. The semi-major axis lies in the
 * equatorial plane and the semi-minor axis follows the polar axis. Instances
 * validate their dimensions and precompute the coefficients required by
 * geodetic conversions.
 */
export class Ellipsoid {
    /** WGS 84 reference ellipsoid used by EPSG:4978 and EPSG:4979. */
    public static readonly WGS84 = Ellipsoid.fromSemiMajorAxisAndInverseFlattening("WGS84", 6378137, 298.257223563);

    /** Geodetic Reference System 1980 ellipsoid. */
    public static readonly GRS80 = Ellipsoid.fromSemiMajorAxisAndInverseFlattening("GRS80", 6378137, 298.257222101);

    /** Geodetic Reference System 1967 ellipsoid. */
    public static readonly GRS67 = Ellipsoid.fromSemiMajorAxisAndInverseFlattening("GRS67", 6378160, 298.25);

    /** Australian National Spheroid. */
    public static readonly ANS = Ellipsoid.fromSemiMajorAxisAndInverseFlattening("ANS", 6378160, 298.25);

    /** World Geodetic System 1972 ellipsoid. */
    public static readonly WGS72 = Ellipsoid.fromSemiMajorAxisAndInverseFlattening("WGS72", 6378135, 298.26);

    /** Clarke 1858 ellipsoid. */
    public static readonly Clarke1858 = Ellipsoid.fromSemiMajorAxisAndInverseFlattening("Clarke1858", 6378293.645, 294.26);

    /** Clarke 1880 ellipsoid. */
    public static readonly Clarke1880 = Ellipsoid.fromSemiMajorAxisAndInverseFlattening("Clarke1880", 6378249.145, 293.465);

    private constructor(
        private readonly identifier: string,
        private readonly major: number,
        private readonly minor: number,
    ) {
        if (identifier.trim().length === 0) throw new RangeError("Ellipsoid name must not be empty.");
        if (!Number.isFinite(major) || major <= 0) throw new RangeError("Semi-major axis must be a positive finite number.");
        if (!Number.isFinite(minor) || minor <= 0) throw new RangeError("Semi-minor axis must be a positive finite number.");
        if (minor > major)
            throw new RangeError("An oblate ellipsoid requires the semi-minor axis to be no greater than the semi-major axis.");
    }

    /**
     * Creates an ellipsoid from its semi-major axis and inverse flattening.
     *
     * `Infinity` represents a sphere.
     *
     * @param name - Stable human-readable ellipsoid name.
     * @param semiMajorAxis - Equatorial semi-major axis in metres.
     * @param inverseFlattening - Reciprocal flattening, or `Infinity` for a sphere.
     * @returns A validated immutable ellipsoid.
     */
    public static fromSemiMajorAxisAndInverseFlattening(name: string, semiMajorAxis: number, inverseFlattening: number): Ellipsoid {
        if (inverseFlattening !== Number.POSITIVE_INFINITY && (!Number.isFinite(inverseFlattening) || inverseFlattening <= 1)) {
            throw new RangeError("Inverse flattening must be greater than one, or Infinity for a sphere.");
        }
        const flattening = inverseFlattening === Number.POSITIVE_INFINITY ? 0 : 1 / inverseFlattening;
        return new Ellipsoid(name, semiMajorAxis, semiMajorAxis * (1 - flattening));
    }

    /**
     * Creates an ellipsoid from its semi-major axis and flattening.
     *
     * @param name - Stable human-readable ellipsoid name.
     * @param semiMajorAxis - Equatorial semi-major axis in metres.
     * @param flattening - Flattening in the interval `[0, 1)`.
     * @returns A validated immutable ellipsoid.
     */
    public static fromSemiMajorAxisAndFlattening(name: string, semiMajorAxis: number, flattening: number): Ellipsoid {
        if (!Number.isFinite(flattening) || flattening < 0 || flattening >= 1) {
            throw new RangeError("Flattening must be a finite number in the interval [0, 1).");
        }
        return new Ellipsoid(name, semiMajorAxis, semiMajorAxis * (1 - flattening));
    }

    /**
     * Creates an ellipsoid from its semi-major and semi-minor axes.
     *
     * @param name - Stable human-readable ellipsoid name.
     * @param semiMajorAxis - Equatorial semi-major axis in metres.
     * @param semiMinorAxis - Polar semi-minor axis in metres.
     * @returns A validated immutable ellipsoid.
     */
    public static fromAxes(name: string, semiMajorAxis: number, semiMinorAxis: number): Ellipsoid {
        return new Ellipsoid(name, semiMajorAxis, semiMinorAxis);
    }

    /**
     * Creates a spherical reference surface.
     *
     * @param name - Stable human-readable sphere name.
     * @param radius - Radius in metres.
     * @returns An ellipsoid with zero flattening.
     */
    public static sphere(name: string, radius: number): Ellipsoid {
        return new Ellipsoid(name, radius, radius);
    }

    /** Stable human-readable identifier. */
    public get name(): string {
        return this.identifier;
    }

    /** Equatorial semi-major axis in metres. */
    public get semiMajorAxis(): number {
        return this.major;
    }

    /** Polar semi-minor axis in metres. */
    public get semiMinorAxis(): number {
        return this.minor;
    }

    /** Largest ellipsoid radius in metres. */
    public get maximumRadius(): number {
        return this.major;
    }

    /** Smallest ellipsoid radius in metres. */
    public get minimumRadius(): number {
        return this.minor;
    }

    /** Ellipsoid flattening `(a - b) / a`. */
    public get flattening(): number {
        return (this.major - this.minor) / this.major;
    }

    /** Reciprocal flattening, or `Infinity` for a sphere. */
    public get inverseFlattening(): number {
        const flattening = this.flattening;
        return flattening === 0 ? Number.POSITIVE_INFINITY : 1 / flattening;
    }

    /** First eccentricity squared `e^2`. */
    public get squaredEccentricity(): number {
        return 1 - (this.minor * this.minor) / (this.major * this.major);
    }

    /** Compatibility alias for {@link squaredEccentricity}. */
    public get sqrEccentricity(): number {
        return this.squaredEccentricity;
    }

    /** First eccentricity `e`. */
    public get eccentricity(): number {
        return Math.sqrt(this.squaredEccentricity);
    }

    /** Second eccentricity squared `e'^2`. */
    public get secondSquaredEccentricity(): number {
        return (this.major * this.major - this.minor * this.minor) / (this.minor * this.minor);
    }

    /** Linear eccentricity in metres. */
    public get linearEccentricity(): number {
        return Math.sqrt(this.major * this.major - this.minor * this.minor);
    }

    /** Precomputed coefficient `1 - e^2`. */
    public get oneMinusSquaredEccentricity(): number {
        return 1 - this.squaredEccentricity;
    }

    /** Compatibility alias for {@link oneMinusSquaredEccentricity}. */
    public get oneMinusSqrEccentricity(): number {
        return this.oneMinusSquaredEccentricity;
    }

    /** Semi-latus rectum in metres. */
    public get semiLatusRectum(): number {
        return this.major * this.oneMinusSquaredEccentricity;
    }

    /**
     * Returns the prime-vertical radius of curvature at a geodetic latitude.
     *
     * @param latitudeRadians - Geodetic latitude in radians.
     * @returns Prime-vertical radius in metres.
     */
    public primeVerticalRadius(latitudeRadians: number): number {
        const sine = Math.sin(latitudeRadians);
        return this.major / Math.sqrt(1 - this.squaredEccentricity * sine * sine);
    }

    /**
     * Returns the meridional radius of curvature at a geodetic latitude.
     *
     * @param latitudeRadians - Geodetic latitude in radians.
     * @returns Meridional radius in metres.
     */
    public meridionalRadius(latitudeRadians: number): number {
        const sine = Math.sin(latitudeRadians);
        const denominator = 1 - this.squaredEccentricity * sine * sine;
        return (this.major * this.oneMinusSquaredEccentricity) / Math.pow(denominator, 1.5);
    }

    /**
     * Returns the geocentric surface radius at a latitude.
     *
     * @param latitudeRadians - Geocentric latitude in radians.
     * @returns Distance from the ellipsoid centre to its surface in metres.
     */
    public radiusAtLatitude(latitudeRadians: number): number {
        const cosine = Math.cos(latitudeRadians);
        const sine = Math.sin(latitudeRadians);
        const majorSquared = this.major * this.major;
        const minorSquared = this.minor * this.minor;
        return Math.sqrt(
            ((majorSquared * cosine) ** 2 + (minorSquared * sine) ** 2) / ((this.major * cosine) ** 2 + (this.minor * sine) ** 2),
        );
    }

    /**
     * Intersects a normalized geocentric direction with the ellipsoid surface.
     *
     * @param x - ECEF X component of a normalized direction.
     * @param y - ECEF Y component of a normalized direction.
     * @param z - ECEF Z component of a normalized direction.
     * @returns Distance from the centre to the surface in metres.
     */
    public radiusAtPosition(x: number, y: number, z: number): number {
        const norm = Math.hypot(x, y, z);
        if (Math.abs(norm - 1) > 1e-12) throw new RangeError("Direction passed to radiusAtPosition must be normalized.");
        const denominator = (x * x + y * y) / (this.major * this.major) + (z * z) / (this.minor * this.minor);
        return 1 / Math.sqrt(denominator);
    }

    /**
     * Tests geometric equality independently from the ellipsoid name.
     *
     * @param other - Ellipsoid to compare.
     * @returns `true` when both axes are exactly equal.
     */
    public equals(other: Ellipsoid): boolean {
        return other.major === this.major && other.minor === this.minor;
    }

    /**
     * Creates a uniformly scaled ellipsoid.
     *
     * @param scale - Positive uniform scale applied to both axes.
     * @param name - Name assigned to the scaled instance.
     * @returns A new ellipsoid with unchanged flattening.
     */
    public scaled(scale: number, name = `${this.name} x ${scale}`): Ellipsoid {
        if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Ellipsoid scale must be a positive finite number.");
        return new Ellipsoid(name, this.major * scale, this.minor * scale);
    }

    /**
     * Compatibility alias for {@link scaled}.
     *
     * @param name - Name assigned to the cloned instance.
     * @param scale - Positive uniform scale applied to both axes.
     * @returns A new ellipsoid.
     */
    public clone(name: string, scale = 1): Ellipsoid {
        return this.scaled(scale, name);
    }
}
