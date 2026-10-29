import { DEGREES_TO_RADIANS, RADIANS_TO_DEGREES, normalizeLongitudeRadians } from "./angles";
import type { IGeodeticCoordinates, IMapProjection, IProjectedCoordinates } from "./types";

/** Radius of the sphere of the Web Mercator projection: the WGS84 semi-major axis, in metres. */
export const WEB_MERCATOR_RADIUS = 6378137;

/** Latitude, in degrees, at which the Web Mercator map is square: the northern and southern limit of web map tiles. */
export const WEB_MERCATOR_MAX_LATITUDE_DEGREES = 85.0511287798066;

/**
 * Options describing a Web Mercator projection.
 */
export interface IWebMercatorOptions {
    /** Radius of the sphere in metres. Defaults to {@link WEB_MERCATOR_RADIUS}. */
    radius?: number;
    /** Longitude of the central meridian in radians east of the reference meridian. Defaults to 0. */
    centralMeridianRadians?: number;
    /** Value added to every easting, in metres. Defaults to 0. */
    falseEasting?: number;
    /** Value added to every northing, in metres. Defaults to 0. */
    falseNorthing?: number;
}

function validateFinite(value: number, name: string): void {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number.`);
}

/**
 * Web Mercator projection (EPSG:3857, IOGP method 1024, "Popular Visualisation Pseudo Mercator").
 *
 * Geodetic latitude and longitude, usually WGS84, are projected with the
 * spherical Mercator formulas on a sphere of the WGS84 semi-major axis. The
 * projection is therefore not conformal on the ellipsoid: scale differs by up
 * to 0.7 % between directions. It is the system of web map tiles, not a survey
 * system.
 *
 * Eastings increase toward the east and northings toward the north, both in
 * metres. The poles project to infinity.
 */
export class WebMercatorProjection implements IMapProjection {
    /** Radius of the sphere in metres. */
    public readonly radius: number;
    /** Longitude of the central meridian in radians. */
    public readonly centralMeridianRadians: number;
    /** False easting in metres. */
    public readonly falseEasting: number;
    /** False northing in metres. */
    public readonly falseNorthing: number;

    /**
     * Creates a Web Mercator projection.
     *
     * @param options - Projection parameters. Defaults to EPSG:3857.
     * @throws RangeError When a parameter is not finite or the radius is not positive.
     */
    public constructor(options: IWebMercatorOptions = {}) {
        this.radius = options.radius ?? WEB_MERCATOR_RADIUS;
        this.centralMeridianRadians = options.centralMeridianRadians ?? 0;
        this.falseEasting = options.falseEasting ?? 0;
        this.falseNorthing = options.falseNorthing ?? 0;
        if (!Number.isFinite(this.radius) || this.radius <= 0) throw new RangeError("Radius must be a positive finite number.");
        validateFinite(this.centralMeridianRadians, "Central meridian");
        validateFinite(this.falseEasting, "False easting");
        validateFinite(this.falseNorthing, "False northing");
    }

    /**
     * Projects geodetic coordinates in radians.
     *
     * @param latitudeRadians - Geodetic latitude in radians, strictly between `-PI/2` and `PI/2`.
     * @param longitudeRadians - Longitude in radians east of the reference meridian.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with easting and northing in metres.
     * @throws RangeError When an input is not finite or the latitude is a pole or out of range.
     */
    public geodeticRadiansToProjected(
        latitudeRadians: number,
        longitudeRadians: number,
        target: IProjectedCoordinates = { easting: 0, northing: 0 },
    ): IProjectedCoordinates {
        validateFinite(latitudeRadians, "Latitude");
        validateFinite(longitudeRadians, "Longitude");
        if (Math.abs(latitudeRadians) >= Math.PI / 2) throw new RangeError("Latitude must be strictly within (-PI/2, PI/2) radians.");

        target.easting = this.falseEasting + this.radius * normalizeLongitudeRadians(longitudeRadians - this.centralMeridianRadians);
        target.northing = this.falseNorthing + this.radius * Math.atanh(Math.sin(latitudeRadians));
        return target;
    }

    /**
     * Projects geodetic coordinates in degrees.
     *
     * @param latitudeDegrees - Geodetic latitude in degrees, strictly between `-90` and `90`.
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

        target.latitude = Math.atan(Math.sinh((northing - this.falseNorthing) / this.radius));
        target.longitude = normalizeLongitudeRadians(this.centralMeridianRadians + (easting - this.falseEasting) / this.radius);
        target.height = height;
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
