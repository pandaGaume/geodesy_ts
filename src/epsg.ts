import { DEGREES_TO_RADIANS } from "./angles";
import { Ellipsoid } from "./ellipsoid";
import { LambertConformalConicProjection } from "./lambert-conformal-conic";
import { TransverseMercatorProjection } from "./transverse-mercator";
import type { IMapProjection } from "./types";
import { UtmProjection } from "./utm";
import { WebMercatorProjection } from "./web-mercator";

/**
 * A geographic coordinate reference system: geodetic latitude and longitude in degrees on an ellipsoid.
 */
export interface IEpsgGeographicSystem {
    /** Discriminant of geographic systems. */
    readonly kind: "geographic";
    /** EPSG code of the system. */
    readonly code: number;
    /** Name of the system, as the EPSG registry gives it. */
    readonly name: string;
    /** Ellipsoid of the horizontal datum. */
    readonly ellipsoid: Ellipsoid;
}

/**
 * A projected coordinate reference system: eastings and northings in metres through a map projection.
 */
export interface IEpsgProjectedSystem {
    /** Discriminant of projected systems. */
    readonly kind: "projected";
    /** EPSG code of the system. */
    readonly code: number;
    /** Name of the system, as the EPSG registry gives it. */
    readonly name: string;
    /** Ellipsoid of the horizontal datum, the one the projection uses. */
    readonly ellipsoid: Ellipsoid;
    /** Projection from geodetic coordinates on that ellipsoid to eastings and northings in metres. */
    readonly projection: IMapProjection;
}

/** A coordinate reference system known by its EPSG code. */
export type IEpsgSystem = IEpsgGeographicSystem | IEpsgProjectedSystem;

/** Central meridians in degrees of the NAD83 MTM zones 1 to 10 (EPSG:32181 to 32190). */
const MTM_MERIDIANS = [-53, -56, -58.5, -61.5, -64.5, -67.5, -70.5, -73.5, -76.5, -79.5];
/** Central meridians in degrees of the SWEREF99 local zones (EPSG:3007 to 3018). */
const SWEREF99_ZONE_MERIDIANS = [12, 13.5, 15, 16.5, 18, 14.25, 15.75, 17.25, 18.75, 20.25, 21.75, 23.25];
/** Names of the SWEREF99 local zones, in the order of their codes. */
const SWEREF99_ZONE_NAMES = ["12 00", "13 30", "15 00", "16 30", "18 00", "14 15", "15 45", "17 15", "18 45", "20 15", "21 45", "23 15"];
/** Geographic systems known by their code, with their ellipsoid. */
const GEOGRAPHIC: Record<number, [string, Ellipsoid]> = {
    4326: ["WGS 84", Ellipsoid.WGS84],
    4269: ["NAD83", Ellipsoid.GRS80],
    4617: ["NAD83(CSRS)", Ellipsoid.GRS80],
    4171: ["RGF93 v1", Ellipsoid.GRS80],
    4258: ["ETRS89", Ellipsoid.GRS80],
    4619: ["SWEREF99", Ellipsoid.GRS80],
};

const radians = (degrees: number) => degrees * DEGREES_TO_RADIANS;
const projected = (code: number, name: string, ellipsoid: Ellipsoid, projection: IMapProjection): IEpsgProjectedSystem => ({
    kind: "projected",
    code,
    name,
    ellipsoid,
    projection,
});

function lookup(code: number): IEpsgSystem | undefined {
    const geographic = GEOGRAPHIC[code];
    if (geographic) return { kind: "geographic", code, name: geographic[0], ellipsoid: geographic[1] };
    if (code === 3857 || code === 900913) return projected(code, "WGS 84 / Pseudo-Mercator", Ellipsoid.WGS84, new WebMercatorProjection());
    if (code > 32600 && code <= 32660)
        return projected(code, `WGS 84 / UTM zone ${code - 32600}N`, Ellipsoid.WGS84, new UtmProjection(code - 32600, "N"));
    if (code > 32700 && code <= 32760)
        return projected(code, `WGS 84 / UTM zone ${code - 32700}S`, Ellipsoid.WGS84, new UtmProjection(code - 32700, "S"));
    if (code > 26900 && code <= 26923)
        return projected(code, `NAD83 / UTM zone ${code - 26900}N`, Ellipsoid.GRS80, new UtmProjection(code - 26900, "N", Ellipsoid.GRS80));
    if (code >= 25828 && code <= 25838)
        return projected(
            code,
            `ETRS89 / UTM zone ${code - 25800}N`,
            Ellipsoid.GRS80,
            new UtmProjection(code - 25800, "N", Ellipsoid.GRS80),
        );
    // SWEREF99 TM and ETRS-TM35FIN are defined as UTM zones 33 and 35 on GRS80, extended over the whole country.
    if (code === 3006) return projected(code, "SWEREF99 TM", Ellipsoid.GRS80, new UtmProjection(33, "N", Ellipsoid.GRS80));
    if (code === 3067) return projected(code, "ETRS89 / TM35FIN(E,N)", Ellipsoid.GRS80, new UtmProjection(35, "N", Ellipsoid.GRS80));
    if (code >= 3007 && code <= 3018) {
        const zone = code - 3007;
        return projected(
            code,
            `SWEREF99 ${SWEREF99_ZONE_NAMES[zone]}`,
            Ellipsoid.GRS80,
            new TransverseMercatorProjection({
                ellipsoid: Ellipsoid.GRS80,
                centralMeridianRadians: radians(SWEREF99_ZONE_MERIDIANS[zone]!),
                scaleFactor: 1,
                falseEasting: 150000,
            }),
        );
    }
    if (code >= 32181 && code <= 32190) {
        return projected(
            code,
            `NAD83 / MTM zone ${code - 32180}`,
            Ellipsoid.GRS80,
            new TransverseMercatorProjection({
                ellipsoid: Ellipsoid.GRS80,
                centralMeridianRadians: radians(MTM_MERIDIANS[code - 32181]!),
                scaleFactor: 0.9999,
                falseEasting: 304800,
            }),
        );
    }
    if (code === 32198) {
        return projected(
            code,
            "NAD83 / Quebec Lambert",
            Ellipsoid.GRS80,
            new LambertConformalConicProjection({
                ellipsoid: Ellipsoid.GRS80,
                latitudeOfOriginRadians: radians(44),
                centralMeridianRadians: radians(-68.5),
                standardParallel1Radians: radians(60),
                standardParallel2Radians: radians(46),
            }),
        );
    }
    if (code === 2154) {
        return projected(
            code,
            "RGF93 v1 / Lambert-93",
            Ellipsoid.GRS80,
            new LambertConformalConicProjection({
                ellipsoid: Ellipsoid.GRS80,
                latitudeOfOriginRadians: radians(46.5),
                centralMeridianRadians: radians(3),
                standardParallel1Radians: radians(49),
                standardParallel2Radians: radians(44),
                falseEasting: 700000,
                falseNorthing: 6600000,
            }),
        );
    }
    return undefined;
}

const systems = new Map<number, IEpsgSystem | undefined>();

/**
 * Returns the coordinate reference system of an EPSG code, or `undefined` for a code this registry does not know.
 *
 * Known systems: geographic WGS 84, NAD83, NAD83(CSRS), RGF93, ETRS89 and SWEREF99; Web Mercator; UTM on WGS 84,
 * NAD83 and ETRS89; NAD83 MTM zones and Quebec Lambert; Lambert-93; SWEREF99 TM and its local zones; ETRS-TM35FIN.
 * Every one of them lies on the WGS84 or GRS80 ellipsoid. The registry describes systems and performs no datum
 * transformation: systems on other datums (NAD27, NTF, ED50, RT90) are not listed.
 *
 * @param code - EPSG code, such as 3006 for SWEREF99 TM.
 * @returns The system, shared between calls, or `undefined`.
 */
export function epsgSystem(code: number): IEpsgSystem | undefined {
    if (!systems.has(code)) systems.set(code, Number.isInteger(code) ? lookup(code) : undefined);
    return systems.get(code);
}
