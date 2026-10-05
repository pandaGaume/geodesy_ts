import { DEGREES_TO_RADIANS, normalizeLongitudeDegrees } from "./angles";
import { Ellipsoid } from "./ellipsoid";
import { TransverseMercatorProjection } from "./transverse-mercator";

/** Hemisphere of a UTM zone. `N` uses a false northing of 0 m and `S` a false northing of 10,000,000 m. */
export type UtmHemisphere = "N" | "S";

/** Scale factor on the central meridian of every UTM zone. */
export const UTM_SCALE_FACTOR = 0.9996;

/** False easting of every UTM zone in metres. */
export const UTM_FALSE_EASTING = 500000;

/** False northing of southern UTM zones in metres. */
export const UTM_SOUTH_FALSE_NORTHING = 10000000;

/**
 * Universal Transverse Mercator projection for one zone and hemisphere.
 *
 * Zone `z` is centred on longitude `-183 + 6z` degrees. The ellipsoid must be
 * the one of the horizontal datum: WGS84 for WGS 84, GRS80 for NAD83 and
 * ETRS89. This class does not perform datum transformations.
 */
export class UtmProjection extends TransverseMercatorProjection {
    /**
     * Creates the projection of a UTM zone.
     *
     * @param zone - UTM zone number from 1 to 60.
     * @param hemisphere - `N` for the northern hemisphere or `S` for the southern hemisphere.
     * @param ellipsoid - Ellipsoid of the horizontal datum. Defaults to WGS84.
     * @throws RangeError When the zone or hemisphere is invalid.
     */
    public constructor(
        public readonly zone: number,
        public readonly hemisphere: UtmHemisphere,
        ellipsoid: Ellipsoid = Ellipsoid.WGS84,
    ) {
        if (!Number.isInteger(zone) || zone < 1 || zone > 60) throw new RangeError("UTM zone must be an integer from 1 to 60.");
        if (hemisphere !== "N" && hemisphere !== "S") throw new RangeError("UTM hemisphere must be N or S.");
        super({
            ellipsoid,
            centralMeridianRadians: utmCentralMeridianDegrees(zone) * DEGREES_TO_RADIANS,
            scaleFactor: UTM_SCALE_FACTOR,
            falseEasting: UTM_FALSE_EASTING,
            falseNorthing: hemisphere === "S" ? UTM_SOUTH_FALSE_NORTHING : 0,
        });
    }
}

/**
 * Returns the central meridian of a UTM zone.
 *
 * @param zone - UTM zone number from 1 to 60.
 * @returns Central meridian longitude in degrees.
 */
export function utmCentralMeridianDegrees(zone: number): number {
    return -183 + 6 * zone;
}

/**
 * Returns the standard UTM zone containing a geodetic position.
 *
 * Applies the Norway and Svalbard exceptions of the UTM grid.
 *
 * @param latitudeDegrees - Geodetic latitude in degrees.
 * @param longitudeDegrees - Longitude in degrees east of the reference meridian.
 * @returns UTM zone number from 1 to 60.
 */
export function utmZoneFromDegrees(latitudeDegrees: number, longitudeDegrees: number): number {
    const longitude = normalizeLongitudeDegrees(longitudeDegrees);
    if (latitudeDegrees >= 56 && latitudeDegrees < 64 && longitude >= 3 && longitude < 12) return 32;
    if (latitudeDegrees >= 72 && latitudeDegrees < 84 && longitude >= 0 && longitude < 42) {
        if (longitude < 9) return 31;
        if (longitude < 21) return 33;
        if (longitude < 33) return 35;
        return 37;
    }
    return Math.floor((longitude + 180) / 6) + 1;
}
