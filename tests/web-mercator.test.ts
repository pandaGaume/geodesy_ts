import { describe, expect, it } from "vitest";

import { WEB_MERCATOR_MAX_LATITUDE_DEGREES, WEB_MERCATOR_RADIUS, WebMercatorProjection } from "../src";

describe("WebMercatorProjection", () => {
    it("matches the EPSG example of WGS 84 / Pseudo-Mercator", () => {
        const projected = new WebMercatorProjection().geodeticDegreesToProjected(24 + 22 / 60 + 54.433 / 3600, -(100 + 20 / 60));
        expect(Math.abs(projected.easting - -11169055.58)).toBeLessThan(0.01);
        expect(Math.abs(projected.northing - 2800000.0)).toBeLessThan(0.01);
    });

    it("is square at the latitude limit of web map tiles", () => {
        const projection = new WebMercatorProjection();
        const corner = projection.geodeticDegreesToProjected(WEB_MERCATOR_MAX_LATITUDE_DEGREES, 180);
        expect(Math.abs(corner.northing - Math.PI * WEB_MERCATOR_RADIUS)).toBeLessThan(1e-3);
        expect(Math.abs(Math.abs(corner.easting) - Math.PI * WEB_MERCATOR_RADIUS)).toBeLessThan(1e-3);
    });

    it("round trips geodetic coordinates and normalizes longitudes", () => {
        const projection = new WebMercatorProjection({ centralMeridianRadians: 0.2, falseEasting: 1000, falseNorthing: -500 });
        for (const latitude of [-80, -45, 0, 33.3, 52.6, 84]) {
            for (const longitude of [-179, -75, 0, 12, 179]) {
                const projected = projection.geodeticDegreesToProjected(latitude, longitude);
                const geodetic = projection.projectedToGeodeticDegrees(projected.easting, projected.northing, 7);
                expect(geodetic.latitude).toBeCloseTo(latitude, 11);
                expect(geodetic.longitude).toBeCloseTo(longitude, 11);
                expect(geodetic.height).toBe(7);
            }
        }
        const standard = new WebMercatorProjection();
        expect(standard.geodeticDegreesToProjected(10, 190).easting).toBeCloseTo(standard.geodeticDegreesToProjected(10, -170).easting, 6);
    });

    it("reuses caller-supplied targets", () => {
        const projection = new WebMercatorProjection();
        const projected = { easting: 0, northing: 0 };
        const geodetic = { latitude: 0, longitude: 0, height: 0 };
        expect(projection.geodeticDegreesToProjected(45, 5, projected)).toBe(projected);
        expect(projection.projectedToGeodeticRadians(1000, 2000, 0, geodetic)).toBe(geodetic);
    });

    it("rejects the poles and invalid parameters", () => {
        const projection = new WebMercatorProjection();
        expect(() => projection.geodeticDegreesToProjected(90, 0)).toThrow(RangeError);
        expect(() => projection.geodeticDegreesToProjected(-90, 0)).toThrow(RangeError);
        expect(() => projection.geodeticDegreesToProjected(Number.NaN, 0)).toThrow(RangeError);
        expect(() => projection.projectedToGeodeticDegrees(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
        expect(() => new WebMercatorProjection({ radius: 0 })).toThrow(RangeError);
    });
});
