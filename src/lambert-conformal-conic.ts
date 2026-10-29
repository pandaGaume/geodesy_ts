import { DEGREES_TO_RADIANS, RADIANS_TO_DEGREES, normalizeLongitudeRadians } from "./angles";
import { Ellipsoid } from "./ellipsoid";
import type { IGeodeticCoordinates, IMapProjection, IProjectedCoordinates } from "./types";

/** Convergence threshold of the inverse latitude iteration, in radians. */
const LATITUDE_TOLERANCE = 1e-12;
/** Upper bound on inverse iterations. Convergence normally takes four or five steps. */
const MAX_ITERATIONS = 20;
/** Standard parallels closer than this, in radians, are treated as a single tangent parallel. */
const PARALLEL_TOLERANCE = 1e-12;

/**
 * Options describing a Lambert conformal conic projection.
 *
 * One standard parallel (EPSG method 9801): give the latitude of the natural
 * origin and its scale factor; the cone is tangent along that parallel.
 * Two standard parallels (EPSG method 9802): give the latitude of the false
 * origin and both parallels; the scale is 1 along each of them.
 */
export interface ILambertConformalConicOptions {
    /** Reference ellipsoid. Defaults to WGS84. */
    ellipsoid?: Ellipsoid;
    /** Geodetic latitude of the origin in radians, where the northing equals the false northing. */
    latitudeOfOriginRadians: number;
    /** Longitude of the origin, the central meridian of the cone, in radians east of the reference meridian. */
    centralMeridianRadians: number;
    /** First standard parallel in radians. Defaults to the latitude of origin. */
    standardParallel1Radians?: number;
    /** Second standard parallel in radians. Defaults to the first standard parallel. */
    standardParallel2Radians?: number;
    /** Scale factor along the standard parallels. Defaults to 1. */
    scaleFactor?: number;
    /** Value added to every easting, in metres. Defaults to 0. */
    falseEasting?: number;
    /** Value added to every northing, in metres. Defaults to 0. */
    falseNorthing?: number;
}

function validateFinite(value: number, name: string): void {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number.`);
}

/**
 * Ellipsoidal Lambert conformal conic projection.
 *
 * The implementation follows the closed formulas of IOGP Guidance Note 7-2
 * (EPSG methods 9801 and 9802), after Snyder (1987), "Map Projections: A Working
 * Manual". The forward conversion is exact; the inverse iterates the geodetic
 * latitude to below a picometre on the ellipsoid. Southern cones, whose
 * standard parallels lie south of the equator, are supported.
 *
 * Eastings increase toward the east and northings toward the north, both in
 * metres. Geodetic coordinates use geodetic latitude and longitude east of the
 * reference meridian.
 */
export class LambertConformalConicProjection implements IMapProjection {
    /** Reference ellipsoid of the projection. */
    public readonly ellipsoid: Ellipsoid;
    /** Geodetic latitude of the origin in radians. */
    public readonly latitudeOfOriginRadians: number;
    /** Longitude of the central meridian in radians. */
    public readonly centralMeridianRadians: number;
    /** First standard parallel in radians. */
    public readonly standardParallel1Radians: number;
    /** Second standard parallel in radians. */
    public readonly standardParallel2Radians: number;
    /** Scale factor along the standard parallels. */
    public readonly scaleFactor: number;
    /** False easting in metres. */
    public readonly falseEasting: number;
    /** False northing in metres. */
    public readonly falseNorthing: number;

    private readonly eccentricity: number;
    /** Cone constant: the ratio of the angle between two meridians on the map to their longitude difference. */
    private readonly coneConstant: number;
    /** Radius of a parallel per power of its isometric function: semi-major axis, F constant and scale factor, in metres. */
    private readonly radiusFactor: number;
    /** Radius of the parallel of origin on the map, in metres. */
    private readonly originRadius: number;

    /**
     * Creates a Lambert conformal conic projection.
     *
     * @param options - Projection parameters.
     * @throws RangeError When a parameter is not finite, a latitude is out of range, a standard parallel is a pole,
     *     the standard parallels are symmetric about the equator or the scale factor is not positive.
     */
    public constructor(options: ILambertConformalConicOptions) {
        this.ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
        this.latitudeOfOriginRadians = options.latitudeOfOriginRadians;
        this.centralMeridianRadians = options.centralMeridianRadians;
        this.standardParallel1Radians = options.standardParallel1Radians ?? this.latitudeOfOriginRadians;
        this.standardParallel2Radians = options.standardParallel2Radians ?? this.standardParallel1Radians;
        this.scaleFactor = options.scaleFactor ?? 1;
        this.falseEasting = options.falseEasting ?? 0;
        this.falseNorthing = options.falseNorthing ?? 0;
        validateFinite(this.latitudeOfOriginRadians, "Latitude of origin");
        validateFinite(this.centralMeridianRadians, "Central meridian");
        validateFinite(this.standardParallel1Radians, "First standard parallel");
        validateFinite(this.standardParallel2Radians, "Second standard parallel");
        validateFinite(this.falseEasting, "False easting");
        validateFinite(this.falseNorthing, "False northing");
        if (!Number.isFinite(this.scaleFactor) || this.scaleFactor <= 0)
            throw new RangeError("Scale factor must be a positive finite number.");
        if (Math.abs(this.latitudeOfOriginRadians) > Math.PI / 2)
            throw new RangeError("Latitude of origin must be within [-PI/2, PI/2] radians.");
        for (const parallel of [this.standardParallel1Radians, this.standardParallel2Radians])
            if (Math.abs(parallel) >= Math.PI / 2) throw new RangeError("Standard parallels must be strictly between the poles.");
        if (Math.abs(this.standardParallel1Radians + this.standardParallel2Radians) < PARALLEL_TOLERANCE)
            throw new RangeError("Standard parallels must not be symmetric about the equator.");

        this.eccentricity = this.ellipsoid.eccentricity;
        const m1 = this.parallelRadiusRatio(this.standardParallel1Radians);
        const t1 = this.isometricFunction(this.standardParallel1Radians);
        if (Math.abs(this.standardParallel1Radians - this.standardParallel2Radians) < PARALLEL_TOLERANCE) {
            this.coneConstant = Math.sin(this.standardParallel1Radians);
        } else {
            const m2 = this.parallelRadiusRatio(this.standardParallel2Radians);
            const t2 = this.isometricFunction(this.standardParallel2Radians);
            this.coneConstant = (Math.log(m1) - Math.log(m2)) / (Math.log(t1) - Math.log(t2));
        }
        this.radiusFactor = (this.ellipsoid.semiMajorAxis * m1 * this.scaleFactor) / (this.coneConstant * t1 ** this.coneConstant);
        this.originRadius = this.mapRadius(this.latitudeOfOriginRadians);
        if (!Number.isFinite(this.originRadius)) throw new RangeError("Latitude of origin must not be the pole opposite the cone apex.");
    }

    /** Radius of a parallel divided by the semi-major axis: `cos(phi) / sqrt(1 - e^2 sin^2(phi))`. */
    private parallelRadiusRatio(latitudeRadians: number): number {
        const sinLatitude = Math.sin(latitudeRadians);
        return Math.cos(latitudeRadians) / Math.sqrt(1 - this.eccentricity * this.eccentricity * sinLatitude * sinLatitude);
    }

    /** Snyder's `t`: `tan(PI/4 - phi/2) / ((1 - e sin(phi)) / (1 + e sin(phi)))^(e/2)`. */
    private isometricFunction(latitudeRadians: number): number {
        const eSinLatitude = this.eccentricity * Math.sin(latitudeRadians);
        return Math.tan(Math.PI / 4 - latitudeRadians / 2) / ((1 - eSinLatitude) / (1 + eSinLatitude)) ** (this.eccentricity / 2);
    }

    /** Radius of a parallel on the map, in metres; zero at the cone apex, infinite at the opposite pole. */
    private mapRadius(latitudeRadians: number): number {
        // tan(PI/2) is finite in floating point: name the opposite pole rather than return a huge radius.
        if (Math.abs(latitudeRadians) === Math.PI / 2 && Math.sign(latitudeRadians) !== Math.sign(this.coneConstant))
            return Number.POSITIVE_INFINITY;
        return this.radiusFactor * this.isometricFunction(latitudeRadians) ** this.coneConstant;
    }

    /**
     * Projects geodetic coordinates in radians.
     *
     * @param latitudeRadians - Geodetic latitude in radians, within `[-PI/2, PI/2]`.
     * @param longitudeRadians - Longitude in radians east of the reference meridian.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with easting and northing in metres.
     * @throws RangeError When an input is not finite, the latitude is out of range or it is the pole opposite the cone apex.
     */
    public geodeticRadiansToProjected(
        latitudeRadians: number,
        longitudeRadians: number,
        target: IProjectedCoordinates = { easting: 0, northing: 0 },
    ): IProjectedCoordinates {
        validateFinite(latitudeRadians, "Latitude");
        validateFinite(longitudeRadians, "Longitude");
        if (Math.abs(latitudeRadians) > Math.PI / 2) throw new RangeError("Latitude must be within [-PI/2, PI/2] radians.");

        const radius = this.mapRadius(latitudeRadians);
        if (!Number.isFinite(radius)) throw new RangeError("The pole opposite the cone apex cannot be projected.");
        const theta = this.coneConstant * normalizeLongitudeRadians(longitudeRadians - this.centralMeridianRadians);
        target.easting = this.falseEasting + radius * Math.sin(theta);
        target.northing = this.falseNorthing + this.originRadius - radius * Math.cos(theta);
        return target;
    }

    /**
     * Projects geodetic coordinates in degrees.
     *
     * @param latitudeDegrees - Geodetic latitude in degrees, within `[-90, 90]`.
     * @param longitudeDegrees - Longitude in degrees east of the reference meridian.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with easting and northing in metres.
     */
    public geodeticDegreesToProjected(
        latitudeDegrees: number,
        longitudeDegrees: number,
        target?: IProjectedCoordinates,
    ): IProjectedCoordinates {
        return this.geodeticRadiansToProjected(latitudeDegrees * DEGREES_TO_RADIANS, longitudeDegrees * DEGREES_TO_RADIANS, target);
    }

    /**
     * Converts projected coordinates to geodetic coordinates in radians.
     *
     * @param easting - Easting in metres, including the false easting.
     * @param northing - Northing in metres, including the false northing.
     * @param height - Ellipsoidal height in metres copied to the result. Defaults to 0.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with geodetic latitude and longitude in radians, longitude normalized to `[-PI, PI)`.
     * @throws RangeError When an input is not finite.
     */
    public projectedToGeodeticRadians(
        easting: number,
        northing: number,
        height = 0,
        target: IGeodeticCoordinates = { latitude: 0, longitude: 0, height: 0 },
    ): IGeodeticCoordinates {
        validateFinite(easting, "Easting");
        validateFinite(northing, "Northing");
        validateFinite(height, "Height");

        // On a southern cone the apex is the south pole: mirror the plane so both cases share one formula.
        const sign = Math.sign(this.coneConstant);
        const x = sign * (easting - this.falseEasting);
        const y = sign * (this.originRadius - (northing - this.falseNorthing));
        const radius = Math.hypot(x, y);
        target.height = height;
        if (radius === 0) {
            target.latitude = (sign * Math.PI) / 2;
            target.longitude = normalizeLongitudeRadians(this.centralMeridianRadians);
            return target;
        }

        const t = (radius / (sign * this.radiusFactor)) ** (1 / this.coneConstant);
        const halfEccentricity = this.eccentricity / 2;
        let latitude = Math.PI / 2 - 2 * Math.atan(t);
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const eSinLatitude = this.eccentricity * Math.sin(latitude);
            const next = Math.PI / 2 - 2 * Math.atan(t * ((1 - eSinLatitude) / (1 + eSinLatitude)) ** halfEccentricity);
            const delta = next - latitude;
            latitude = next;
            if (Math.abs(delta) <= LATITUDE_TOLERANCE) break;
        }

        target.latitude = latitude;
        target.longitude = normalizeLongitudeRadians(this.centralMeridianRadians + Math.atan2(x, y) / this.coneConstant);
        return target;
    }

    /**
     * Converts projected coordinates to geodetic coordinates in degrees.
     *
     * @param easting - Easting in metres, including the false easting.
     * @param northing - Northing in metres, including the false northing.
     * @param height - Ellipsoidal height in metres copied to the result. Defaults to 0.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with geodetic latitude and longitude in degrees, longitude normalized to `[-180, 180)`.
     */
    public projectedToGeodeticDegrees(easting: number, northing: number, height = 0, target?: IGeodeticCoordinates): IGeodeticCoordinates {
        const result = this.projectedToGeodeticRadians(easting, northing, height, target);
        result.latitude *= RADIANS_TO_DEGREES;
        result.longitude *= RADIANS_TO_DEGREES;
        return result;
    }
}
