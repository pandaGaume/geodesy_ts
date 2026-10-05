import { DEGREES_TO_RADIANS, RADIANS_TO_DEGREES, normalizeLongitudeRadians } from "./angles";
import { Ellipsoid } from "./ellipsoid";
import type { IGeodeticCoordinates, IProjectedCoordinates } from "./types";

/** Convergence threshold of the inverse conformal latitude iteration, applied to the latitude tangent. */
const TAU_TOLERANCE = 1e-12;
/** Upper bound on inverse iterations. Convergence normally takes two or three steps. */
const MAX_ITERATIONS = 10;

/**
 * Options describing a transverse Mercator projection.
 */
export interface ITransverseMercatorOptions {
    /** Reference ellipsoid. Defaults to WGS84. */
    ellipsoid?: Ellipsoid;
    /** Longitude of the central meridian in radians east of the reference meridian. */
    centralMeridianRadians: number;
    /** Scale factor on the central meridian. Defaults to 1. */
    scaleFactor?: number;
    /** Value added to every easting, in metres. Defaults to 0. */
    falseEasting?: number;
    /** Value added to every northing, in metres. Defaults to 0. */
    falseNorthing?: number;
}

function validateFinite(value: number, name: string): void {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number.`);
}

/** Conformal latitude tangent from the geodetic latitude tangent. */
function conformalTangent(tau: number, eccentricity: number): number {
    const sigma = Math.sinh(eccentricity * Math.atanh((eccentricity * tau) / Math.hypot(1, tau)));
    return tau * Math.hypot(1, sigma) - sigma * Math.hypot(1, tau);
}

/**
 * Ellipsoidal transverse Mercator projection.
 *
 * The implementation uses the Kruger series to sixth order in the third
 * flattening, as described by Karney (2011), "Transverse Mercator with an
 * accuracy of a few nanometers". The error stays below one millimetre within
 * several thousand kilometres of the central meridian, which covers every UTM
 * zone with a wide margin.
 *
 * Eastings increase toward the east and northings toward the north, both in
 * metres. Geodetic coordinates use geodetic latitude and longitude east of the
 * reference meridian.
 */
export class TransverseMercatorProjection {
    /** Reference ellipsoid of the projection. */
    public readonly ellipsoid: Ellipsoid;
    /** Longitude of the central meridian in radians. */
    public readonly centralMeridianRadians: number;
    /** Scale factor on the central meridian. */
    public readonly scaleFactor: number;
    /** False easting in metres. */
    public readonly falseEasting: number;
    /** False northing in metres. */
    public readonly falseNorthing: number;

    private readonly eccentricity: number;
    /** Rectifying radius multiplied by the central scale factor, in metres. */
    private readonly scaledRectifyingRadius: number;
    private readonly alpha: readonly number[];
    private readonly beta: readonly number[];

    /**
     * Creates a transverse Mercator projection.
     *
     * @param options - Projection parameters.
     * @throws RangeError When a parameter is not finite or the scale factor is not positive.
     */
    public constructor(options: ITransverseMercatorOptions) {
        this.ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
        this.centralMeridianRadians = options.centralMeridianRadians;
        this.scaleFactor = options.scaleFactor ?? 1;
        this.falseEasting = options.falseEasting ?? 0;
        this.falseNorthing = options.falseNorthing ?? 0;
        validateFinite(this.centralMeridianRadians, "Central meridian");
        validateFinite(this.falseEasting, "False easting");
        validateFinite(this.falseNorthing, "False northing");
        if (!Number.isFinite(this.scaleFactor) || this.scaleFactor <= 0)
            throw new RangeError("Scale factor must be a positive finite number.");

        const flattening = this.ellipsoid.flattening;
        const n = flattening / (2 - flattening);
        const n2 = n * n;
        const n3 = n2 * n;
        const n4 = n3 * n;
        const n5 = n4 * n;
        const n6 = n5 * n;

        this.eccentricity = this.ellipsoid.eccentricity;
        const rectifyingRadius = (this.ellipsoid.semiMajorAxis / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
        this.scaledRectifyingRadius = this.scaleFactor * rectifyingRadius;

        this.alpha = [
            n / 2 - (2 / 3) * n2 + (5 / 16) * n3 + (41 / 180) * n4 - (127 / 288) * n5 + (7891 / 37800) * n6,
            (13 / 48) * n2 - (3 / 5) * n3 + (557 / 1440) * n4 + (281 / 630) * n5 - (1983433 / 1935360) * n6,
            (61 / 240) * n3 - (103 / 140) * n4 + (15061 / 26880) * n5 + (167603 / 181440) * n6,
            (49561 / 161280) * n4 - (179 / 168) * n5 + (6601661 / 7257600) * n6,
            (34729 / 80640) * n5 - (3418889 / 1995840) * n6,
            (212378941 / 319334400) * n6,
        ];
        this.beta = [
            n / 2 - (2 / 3) * n2 + (37 / 96) * n3 - (1 / 360) * n4 - (81 / 512) * n5 + (96199 / 604800) * n6,
            (1 / 48) * n2 + (1 / 15) * n3 - (437 / 1440) * n4 + (46 / 105) * n5 - (1118711 / 3870720) * n6,
            (17 / 480) * n3 - (37 / 840) * n4 - (209 / 4480) * n5 + (5569 / 90720) * n6,
            (4397 / 161280) * n4 - (11 / 504) * n5 - (830251 / 7257600) * n6,
            (4583 / 161280) * n5 - (108847 / 3991680) * n6,
            (20648693 / 638668800) * n6,
        ];
    }

    /**
     * Projects geodetic coordinates in radians.
     *
     * @param latitudeRadians - Geodetic latitude in radians, within `[-PI/2, PI/2]`.
     * @param longitudeRadians - Longitude in radians east of the reference meridian.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with easting and northing in metres.
     * @throws RangeError When an input is not finite or the latitude is out of range.
     */
    public geodeticRadiansToProjected(
        latitudeRadians: number,
        longitudeRadians: number,
        target: IProjectedCoordinates = { easting: 0, northing: 0 },
    ): IProjectedCoordinates {
        validateFinite(latitudeRadians, "Latitude");
        validateFinite(longitudeRadians, "Longitude");
        if (Math.abs(latitudeRadians) > Math.PI / 2) throw new RangeError("Latitude must be within [-PI/2, PI/2] radians.");

        const deltaLongitude = normalizeLongitudeRadians(longitudeRadians - this.centralMeridianRadians);
        const cosLongitude = Math.cos(deltaLongitude);
        const sinLongitude = Math.sin(deltaLongitude);

        const tau = Math.tan(latitudeRadians);
        const tauPrime = conformalTangent(tau, this.eccentricity);
        const xiPrime = Math.atan2(tauPrime, cosLongitude);
        const etaPrime = Math.asinh(sinLongitude / Math.hypot(tauPrime, cosLongitude));

        let xi = xiPrime;
        let eta = etaPrime;
        for (let j = 1; j <= 6; j++) {
            const coefficient = this.alpha[j - 1]!;
            xi += coefficient * Math.sin(2 * j * xiPrime) * Math.cosh(2 * j * etaPrime);
            eta += coefficient * Math.cos(2 * j * xiPrime) * Math.sinh(2 * j * etaPrime);
        }

        target.easting = this.falseEasting + this.scaledRectifyingRadius * eta;
        target.northing = this.falseNorthing + this.scaledRectifyingRadius * xi;
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

        const eta = (easting - this.falseEasting) / this.scaledRectifyingRadius;
        const xi = (northing - this.falseNorthing) / this.scaledRectifyingRadius;

        let xiPrime = xi;
        let etaPrime = eta;
        for (let j = 1; j <= 6; j++) {
            const coefficient = this.beta[j - 1]!;
            xiPrime -= coefficient * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
            etaPrime -= coefficient * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
        }

        const sinhEtaPrime = Math.sinh(etaPrime);
        const sinXiPrime = Math.sin(xiPrime);
        const cosXiPrime = Math.cos(xiPrime);
        const tauPrime = sinXiPrime / Math.hypot(sinhEtaPrime, cosXiPrime);

        const oneMinusE2 = 1 - this.eccentricity * this.eccentricity;
        let tau = tauPrime;
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            const tauIPrime = conformalTangent(tau, this.eccentricity);
            const delta =
                ((tauPrime - tauIPrime) / Math.hypot(1, tauIPrime)) * ((1 + oneMinusE2 * tau * tau) / (oneMinusE2 * Math.hypot(1, tau)));
            tau += delta;
            if (Math.abs(delta) <= TAU_TOLERANCE * Math.max(1, Math.abs(tau))) break;
        }

        target.latitude = Math.atan(tau);
        target.longitude = normalizeLongitudeRadians(this.centralMeridianRadians + Math.atan2(sinhEtaPrime, cosXiPrime));
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
