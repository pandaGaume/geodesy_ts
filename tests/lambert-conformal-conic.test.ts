import { describe, expect, it } from "vitest";

import { DEGREES_TO_RADIANS, Ellipsoid, LambertConformalConicProjection } from "../src";

/** Degrees from sexagesimal degrees, minutes and seconds, the sign carried by the degrees. */
function dms(degrees: number, minutes: number, seconds: number): number {
    return Math.sign(degrees || 1) * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
}
/** The US survey foot in metres. */
const US_SURVEY_FOOT = 1200 / 3937;
const CLARKE_1866 = Ellipsoid.fromSemiMajorAxisAndInverseFlattening("Clarke1866", 6378206.4, 294.9786982);

/** NAD83 / Quebec Lambert (EPSG:32198). */
function quebecLambert(): LambertConformalConicProjection {
    return new LambertConformalConicProjection({
        ellipsoid: Ellipsoid.GRS80,
        latitudeOfOriginRadians: 44 * DEGREES_TO_RADIANS,
        centralMeridianRadians: -68.5 * DEGREES_TO_RADIANS,
        standardParallel1Radians: 60 * DEGREES_TO_RADIANS,
        standardParallel2Radians: 46 * DEGREES_TO_RADIANS,
    });
}

/** Scale along the meridian and along the parallel at a point, from finite differences. */
function scales(projection: LambertConformalConicProjection, ellipsoid: Ellipsoid, latitude: number, longitude: number): [number, number] {
    const step = 1e-7;
    const phi = latitude * DEGREES_TO_RADIANS;
    const lambda = longitude * DEGREES_TO_RADIANS;
    const origin = projection.geodeticRadiansToProjected(phi, lambda);
    const north = projection.geodeticRadiansToProjected(phi + step, lambda);
    const east = projection.geodeticRadiansToProjected(phi, lambda + step);
    const northScale =
        Math.hypot(north.easting - origin.easting, north.northing - origin.northing) / (ellipsoid.meridionalRadius(phi) * step);
    const eastScale =
        Math.hypot(east.easting - origin.easting, east.northing - origin.northing) /
        (ellipsoid.primeVerticalRadius(phi) * Math.cos(phi) * step);
    return [northScale, eastScale];
}

describe("LambertConformalConicProjection", () => {
    it("matches the EPSG example of two standard parallels (NAD27 / Texas South Central)", () => {
        const projection = new LambertConformalConicProjection({
            ellipsoid: CLARKE_1866,
            latitudeOfOriginRadians: dms(27, 50, 0) * DEGREES_TO_RADIANS,
            centralMeridianRadians: -99 * DEGREES_TO_RADIANS,
            standardParallel1Radians: dms(28, 23, 0) * DEGREES_TO_RADIANS,
            standardParallel2Radians: dms(30, 17, 0) * DEGREES_TO_RADIANS,
            falseEasting: 2000000 * US_SURVEY_FOOT,
        });
        const projected = projection.geodeticDegreesToProjected(28.5, -96);
        expect(Math.abs(projected.easting / US_SURVEY_FOOT - 2963503.91)).toBeLessThan(0.01);
        expect(Math.abs(projected.northing / US_SURVEY_FOOT - 254759.8)).toBeLessThan(0.01);
        const geodetic = projection.projectedToGeodeticDegrees(projected.easting, projected.northing);
        expect(geodetic.latitude).toBeCloseTo(28.5, 11);
        expect(geodetic.longitude).toBeCloseTo(-96, 11);
    });

    it("matches the EPSG example of one standard parallel (JAD69 / Jamaica National Grid)", () => {
        const projection = new LambertConformalConicProjection({
            ellipsoid: CLARKE_1866,
            latitudeOfOriginRadians: 18 * DEGREES_TO_RADIANS,
            centralMeridianRadians: -77 * DEGREES_TO_RADIANS,
            scaleFactor: 1,
            falseEasting: 250000,
            falseNorthing: 150000,
        });
        const projected = projection.geodeticDegreesToProjected(dms(17, 55, 55.8), -dms(76, 56, 37.26));
        expect(Math.abs(projected.easting - 255966.58)).toBeLessThan(0.01);
        expect(Math.abs(projected.northing - 142493.51)).toBeLessThan(0.01);
    });

    it("places the Quebec Lambert origin at 44 N, 68.5 W", () => {
        const projection = quebecLambert();
        const geodetic = projection.projectedToGeodeticDegrees(0, 0);
        expect(geodetic.latitude).toBeCloseTo(44, 11);
        expect(geodetic.longitude).toBeCloseTo(-68.5, 11);
        const projected = projection.geodeticDegreesToProjected(44, -68.5);
        expect(projected.easting).toBeCloseTo(0, 6);
        expect(projected.northing).toBeCloseTo(0, 6);
    });

    it("keeps a scale of 1 on both standard parallels and is conformal everywhere", () => {
        const projection = quebecLambert();
        for (const latitude of [46, 60]) {
            const [northScale, eastScale] = scales(projection, Ellipsoid.GRS80, latitude, -60);
            expect(Math.abs(eastScale - 1)).toBeLessThan(1e-7);
            expect(Math.abs(northScale - eastScale)).toBeLessThan(1e-7);
        }
        // The map shrinks between the standard parallels and stretches outside them.
        for (const [latitude, longitude, inside] of [
            [45, -79, false],
            [53, -68.5, true],
            [62, -57, false],
        ] as const) {
            const [northScale, eastScale] = scales(projection, Ellipsoid.GRS80, latitude, longitude);
            expect(Math.abs(northScale - eastScale)).toBeLessThan(1e-7);
            expect(eastScale < 1).toBe(inside);
        }
    });

    it("keeps the scale factor on the parallel of a single standard parallel", () => {
        const projection = new LambertConformalConicProjection({
            latitudeOfOriginRadians: 46.8 * DEGREES_TO_RADIANS,
            centralMeridianRadians: 2.337 * DEGREES_TO_RADIANS,
            scaleFactor: 0.99987742,
        });
        const [northScale, eastScale] = scales(projection, Ellipsoid.WGS84, 46.8, 7);
        expect(Math.abs(eastScale - 0.99987742)).toBeLessThan(1e-7);
        expect(Math.abs(northScale - eastScale)).toBeLessThan(1e-7);
    });

    it("round trips geodetic coordinates within nanometres across a country", () => {
        const projection = quebecLambert();
        for (const latitude of [42, 45, 50, 55, 62.5]) {
            for (const longitude of [-80, -74, -68.5, -61, -57]) {
                const projected = projection.geodeticDegreesToProjected(latitude, longitude);
                const geodetic = projection.projectedToGeodeticDegrees(projected.easting, projected.northing, 330);
                expect(geodetic.latitude).toBeCloseTo(latitude, 11);
                expect(geodetic.longitude).toBeCloseTo(longitude, 11);
                expect(geodetic.height).toBe(330);
            }
        }
    });

    it("mirrors a southern cone about the equator", () => {
        const options = { centralMeridianRadians: -60 * DEGREES_TO_RADIANS, falseEasting: 5000000, falseNorthing: 10000000 };
        const north = new LambertConformalConicProjection({
            ...options,
            latitudeOfOriginRadians: 32 * DEGREES_TO_RADIANS,
            standardParallel1Radians: 5 * DEGREES_TO_RADIANS,
            standardParallel2Radians: 42 * DEGREES_TO_RADIANS,
        });
        const south = new LambertConformalConicProjection({
            ...options,
            latitudeOfOriginRadians: -32 * DEGREES_TO_RADIANS,
            standardParallel1Radians: -5 * DEGREES_TO_RADIANS,
            standardParallel2Radians: -42 * DEGREES_TO_RADIANS,
        });
        for (const [latitude, longitude] of [
            [10, -65],
            [30, -52],
            [48, -71],
        ] as const) {
            const northern = north.geodeticDegreesToProjected(latitude, longitude);
            const southern = south.geodeticDegreesToProjected(-latitude, longitude);
            expect(southern.easting).toBeCloseTo(northern.easting, 6);
            expect(southern.northing - 10000000).toBeCloseTo(-(northern.northing - 10000000), 6);
            const geodetic = south.projectedToGeodeticDegrees(southern.easting, southern.northing);
            expect(geodetic.latitude).toBeCloseTo(-latitude, 11);
            expect(geodetic.longitude).toBeCloseTo(longitude, 11);
        }
    });

    it("projects the cone apex and refuses the opposite pole", () => {
        const projection = quebecLambert();
        const apex = projection.geodeticDegreesToProjected(90, 10);
        const geodetic = projection.projectedToGeodeticDegrees(apex.easting, apex.northing);
        expect(geodetic.latitude).toBe(90);
        expect(geodetic.longitude).toBeCloseTo(-68.5, 11);
        expect(() => projection.geodeticDegreesToProjected(-90, 0)).toThrow(RangeError);
    });

    it("reuses caller-supplied targets", () => {
        const projection = quebecLambert();
        const projected = { easting: 0, northing: 0 };
        const geodetic = { latitude: 0, longitude: 0, height: 0 };
        expect(projection.geodeticDegreesToProjected(52, -75, projected)).toBe(projected);
        expect(projection.projectedToGeodeticRadians(100000, 500000, 0, geodetic)).toBe(geodetic);
    });

    it("rejects invalid parameters and inputs", () => {
        const base = { latitudeOfOriginRadians: 0.8, centralMeridianRadians: 0 };
        expect(
            () => new LambertConformalConicProjection({ ...base, standardParallel1Radians: 0.5, standardParallel2Radians: -0.5 }),
        ).toThrow(RangeError);
        expect(() => new LambertConformalConicProjection({ ...base, standardParallel1Radians: Math.PI / 2 })).toThrow(RangeError);
        expect(() => new LambertConformalConicProjection({ ...base, scaleFactor: 0 })).toThrow(RangeError);
        expect(() => new LambertConformalConicProjection({ ...base, latitudeOfOriginRadians: Number.NaN })).toThrow(RangeError);
        expect(
            () => new LambertConformalConicProjection({ ...base, latitudeOfOriginRadians: -Math.PI / 2, standardParallel1Radians: 0.8 }),
        ).toThrow(RangeError);
        expect(() => quebecLambert().geodeticDegreesToProjected(91, 0)).toThrow(RangeError);
        expect(() => quebecLambert().projectedToGeodeticDegrees(Number.NaN, 0)).toThrow(RangeError);
    });
});
