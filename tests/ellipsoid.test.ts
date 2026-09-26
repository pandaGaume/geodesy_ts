import { describe, expect, it } from "vitest";

import { Ellipsoid } from "../src";

describe("Ellipsoid", () => {
    it("derives the WGS84 axes and eccentricity from inverse flattening", () => {
        expect(Ellipsoid.WGS84.semiMajorAxis).toBe(6378137);
        expect(Ellipsoid.WGS84.semiMinorAxis).toBeCloseTo(6356752.314245179, 6);
        expect(Ellipsoid.WGS84.flattening).toBeCloseTo(1 / 298.257223563, 15);
        expect(Ellipsoid.WGS84.squaredEccentricity).toBeCloseTo(0.0066943799901413165, 15);
    });

    it("supports spherical and uniformly scaled reference surfaces", () => {
        const moon = Ellipsoid.sphere("Moon", 1737400);
        const miniature = moon.scaled(0.001, "Miniature Moon");

        expect(moon.inverseFlattening).toBe(Number.POSITIVE_INFINITY);
        expect(moon.eccentricity).toBe(0);
        expect(moon.radiusAtPosition(1, 0, 0)).toBe(1737400);
        expect(miniature.semiMajorAxis).toBeCloseTo(1737.4, 12);
        expect(miniature.semiMinorAxis).toBeCloseTo(1737.4, 12);
    });

    it("computes ellipsoid curvature radii", () => {
        expect(Ellipsoid.WGS84.primeVerticalRadius(0)).toBe(Ellipsoid.WGS84.semiMajorAxis);
        expect(Ellipsoid.WGS84.meridionalRadius(0)).toBeCloseTo(6335439.3272928195, 6);
        expect(Ellipsoid.WGS84.radiusAtLatitude(Math.PI / 2)).toBeCloseTo(Ellipsoid.WGS84.semiMinorAxis, 6);
    });

    it("rejects inconsistent ellipsoid definitions", () => {
        expect(() => Ellipsoid.fromAxes("", 10, 9)).toThrow(RangeError);
        expect(() => Ellipsoid.fromAxes("invalid", 9, 10)).toThrow(RangeError);
        expect(() => Ellipsoid.fromSemiMajorAxisAndInverseFlattening("invalid", 10, 1)).toThrow(RangeError);
        expect(() => Ellipsoid.WGS84.radiusAtPosition(2, 0, 0)).toThrow(RangeError);
    });
});
