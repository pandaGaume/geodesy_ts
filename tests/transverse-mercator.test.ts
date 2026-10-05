import { describe, expect, it } from "vitest";

import {
    DEGREES_TO_RADIANS,
    Ellipsoid,
    TransverseMercatorProjection,
    UTM_SCALE_FACTOR,
    UtmProjection,
    utmCentralMeridianDegrees,
    utmZoneFromDegrees,
} from "../src";

/** Meridian arc length from the equator, integrated numerically with Simpson's rule as an independent reference. */
function meridianArc(ellipsoid: Ellipsoid, latitudeRadians: number, intervals = 2000): number {
    const step = latitudeRadians / intervals;
    let sum = ellipsoid.meridionalRadius(0) + ellipsoid.meridionalRadius(latitudeRadians);
    for (let index = 1; index < intervals; index++) {
        sum += (index % 2 === 0 ? 2 : 4) * ellipsoid.meridionalRadius(index * step);
    }
    return (sum * step) / 3;
}

describe("TransverseMercatorProjection", () => {
    it("maps the central meridian at the equator to the false origin", () => {
        const utm = new UtmProjection(18, "N");
        const projected = utm.geodeticDegreesToProjected(0, utmCentralMeridianDegrees(18));
        expect(projected.easting).toBeCloseTo(500000, 9);
        expect(projected.northing).toBeCloseTo(0, 9);
    });

    it("scales the WGS84 meridian quadrant by the UTM central scale factor", () => {
        const utm = new UtmProjection(31, "N");
        const pole = utm.geodeticDegreesToProjected(90, 3);
        expect(Math.abs(pole.northing - UTM_SCALE_FACTOR * 10001965.7293)).toBeLessThan(1e-3);
    });

    it("matches an independently integrated meridian arc on the central meridian", () => {
        for (const ellipsoid of [Ellipsoid.WGS84, Ellipsoid.GRS80, Ellipsoid.Clarke1880]) {
            const projection = new TransverseMercatorProjection({ ellipsoid, centralMeridianRadians: 0 });
            for (const latitude of [10, 33.3, 45, 52.6, 71, 84]) {
                const northing = projection.geodeticDegreesToProjected(latitude, 0).northing;
                expect(Math.abs(northing - meridianArc(ellipsoid, latitude * DEGREES_TO_RADIANS))).toBeLessThan(1e-4);
            }
        }
    });

    it("is conformal away from the central meridian", () => {
        const ellipsoid = Ellipsoid.GRS80;
        const utm = new UtmProjection(18, "N", ellipsoid);
        const step = 1e-7;
        for (const [latitude, longitude] of [
            [52.6, -75.9],
            [45, -72.2],
            [10, -77.9],
        ] as const) {
            const phi = latitude * DEGREES_TO_RADIANS;
            const lambda = longitude * DEGREES_TO_RADIANS;
            const origin = utm.geodeticRadiansToProjected(phi, lambda);
            const north = utm.geodeticRadiansToProjected(phi + step, lambda);
            const east = utm.geodeticRadiansToProjected(phi, lambda + step);
            const northScale =
                Math.hypot(north.easting - origin.easting, north.northing - origin.northing) / (ellipsoid.meridionalRadius(phi) * step);
            const eastScale =
                Math.hypot(east.easting - origin.easting, east.northing - origin.northing) /
                (ellipsoid.primeVerticalRadius(phi) * Math.cos(phi) * step);
            expect(Math.abs(northScale - eastScale)).toBeLessThan(1e-7);
            expect(northScale).toBeGreaterThanOrEqual(UTM_SCALE_FACTOR - 1e-7);
        }
    });

    it("round trips geodetic coordinates within nanometres across a zone", () => {
        for (const hemisphere of ["N", "S"] as const) {
            const utm = new UtmProjection(18, hemisphere, Ellipsoid.GRS80);
            const sign = hemisphere === "N" ? 1 : -1;
            for (const latitude of [0.5, 15, 45, 52.6, 70, 83.5]) {
                for (const offset of [-3.5, -1, 0, 2, 3.5]) {
                    const longitude = -75 + offset;
                    const projected = utm.geodeticDegreesToProjected(sign * latitude, longitude);
                    const geodetic = utm.projectedToGeodeticDegrees(projected.easting, projected.northing, 12.5);
                    expect(geodetic.latitude).toBeCloseTo(sign * latitude, 11);
                    expect(geodetic.longitude).toBeCloseTo(longitude, 11);
                    expect(geodetic.height).toBe(12.5);
                }
            }
        }
    });

    it("applies the southern false northing symmetrically", () => {
        const north = new UtmProjection(33, "N").geodeticDegreesToProjected(30, 16);
        const south = new UtmProjection(33, "S").geodeticDegreesToProjected(-30, 16);
        expect(south.easting).toBeCloseTo(north.easting, 6);
        expect(south.northing).toBeCloseTo(10000000 - north.northing, 6);
    });

    it("places a NAD83 / UTM zone 18N drill hole collar near the Cheechoo property", () => {
        const geodetic = new UtmProjection(18, "N", Ellipsoid.GRS80).projectedToGeodeticDegrees(438705.189, 5830304.72);
        expect(geodetic.latitude).toBeGreaterThan(52.5);
        expect(geodetic.latitude).toBeLessThan(52.7);
        expect(geodetic.longitude).toBeGreaterThan(-76);
        expect(geodetic.longitude).toBeLessThan(-75.8);
    });

    it("reuses caller-supplied targets", () => {
        const utm = new UtmProjection(18, "N");
        const projected = { easting: 0, northing: 0 };
        const geodetic = { latitude: 0, longitude: 0, height: 0 };
        expect(utm.geodeticDegreesToProjected(52, -75, projected)).toBe(projected);
        expect(utm.projectedToGeodeticRadians(500000, 5000000, 0, geodetic)).toBe(geodetic);
    });

    it("rejects invalid parameters and inputs", () => {
        expect(() => new UtmProjection(0, "N")).toThrow(RangeError);
        expect(() => new UtmProjection(61, "N")).toThrow(RangeError);
        expect(() => new UtmProjection(18, "X" as "N")).toThrow(RangeError);
        expect(() => new TransverseMercatorProjection({ centralMeridianRadians: 0, scaleFactor: 0 })).toThrow(RangeError);
        expect(() => new UtmProjection(18, "N").geodeticDegreesToProjected(91, 0)).toThrow(RangeError);
        expect(() => new UtmProjection(18, "N").projectedToGeodeticDegrees(Number.NaN, 0)).toThrow(RangeError);
    });
});

describe("utmZoneFromDegrees", () => {
    it("returns the standard zone and the Norway and Svalbard exceptions", () => {
        expect(utmZoneFromDegrees(52.6, -75.9)).toBe(18);
        expect(utmZoneFromDegrees(0, -180)).toBe(1);
        expect(utmZoneFromDegrees(0, 179.9)).toBe(60);
        expect(utmZoneFromDegrees(60, 5)).toBe(32);
        expect(utmZoneFromDegrees(78, 10)).toBe(33);
        expect(utmZoneFromDegrees(78, 35)).toBe(37);
    });
});
