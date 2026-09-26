import { describe, expect, it } from "vitest";

import { Ellipsoid, GeodeticSystem } from "../src";

function applyMatrix(matrix: Float64Array, point: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    return {
        x: matrix[0]! * point.x + matrix[4]! * point.y + matrix[8]! * point.z + matrix[12]!,
        y: matrix[1]! * point.x + matrix[5]! * point.y + matrix[9]! * point.z + matrix[13]!,
        z: matrix[2]! * point.x + matrix[6]! * point.y + matrix[10]! * point.z + matrix[14]!,
    };
}

describe("GeodeticSystem", () => {
    it("converts canonical WGS84 positions to ECEF", () => {
        const system = GeodeticSystem.WGS84;
        expect(system.geodeticDegreesToEcef(0, 0, 0)).toEqual({ x: Ellipsoid.WGS84.semiMajorAxis, y: 0, z: 0 });

        const northPole = system.geodeticDegreesToEcef(90, 0, 0);
        expect(northPole.x).toBeCloseTo(0, 8);
        expect(northPole.y).toBeCloseTo(0, 8);
        expect(northPole.z).toBeCloseTo(Ellipsoid.WGS84.semiMinorAxis, 8);
    });

    it("round trips degrees through ECEF at ground, altitude and below the ellipsoid", () => {
        const system = GeodeticSystem.WGS84;
        for (const coordinate of [
            { latitude: 48.8566, longitude: 2.3522, height: 35 },
            { latitude: -33.8688, longitude: 151.2093, height: 1200 },
            { latitude: 82.5, longitude: -135, height: 400000 },
            { latitude: -20, longitude: 179.9, height: -850 },
        ]) {
            const ecef = system.geodeticDegreesToEcef(coordinate.latitude, coordinate.longitude, coordinate.height);
            const roundTrip = system.ecefToGeodeticDegrees(ecef);
            expect(roundTrip.latitude).toBeCloseTo(coordinate.latitude, 9);
            expect(roundTrip.longitude).toBeCloseTo(coordinate.longitude, 9);
            expect(roundTrip.height).toBeCloseTo(coordinate.height, 5);
        }
    });

    it("handles both poles and rejects the undefined ellipsoid centre", () => {
        const system = GeodeticSystem.WGS84;
        expect(system.ecefToGeodeticDegrees({ x: 0, y: 0, z: Ellipsoid.WGS84.semiMinorAxis })).toEqual({
            latitude: 90,
            longitude: 0,
            height: 0,
        });
        expect(system.ecefToGeodeticDegrees({ x: 0, y: 0, z: -Ellipsoid.WGS84.semiMinorAxis })).toEqual({
            latitude: -90,
            longitude: 0,
            height: 0,
        });
        expect(() => system.ecefToGeodeticRadians({ x: 0, y: 0, z: 0 })).toThrow(RangeError);
    });

    it("supports planetary ellipsoids without Earth constants", () => {
        const mars = Ellipsoid.fromAxes("Mars", 3396190, 3376200);
        const system = new GeodeticSystem(mars);
        const equator = system.geodeticDegreesToEcef(0, 90, 0);
        expect(equator.x).toBeCloseTo(0, 8);
        expect(equator.y).toBeCloseTo(mars.semiMajorAxis, 8);
        expect(equator.z).toBe(0);
    });
});

describe("LocalTangentPlane", () => {
    it("uses conventional ENU and NED axes at latitude and longitude zero", () => {
        const frame = GeodeticSystem.WGS84.createLocalTangentPlaneDegrees(0, 0, 0);
        const basis = frame.basis;
        expect(basis.east.x).toBeCloseTo(0, 15);
        expect(basis.east.y).toBe(1);
        expect(basis.east.z).toBe(0);
        expect(basis.north.x).toBeCloseTo(0, 15);
        expect(basis.north.y).toBeCloseTo(0, 15);
        expect(basis.north.z).toBe(1);
        expect(basis.up.x).toBe(1);
        expect(basis.up.y).toBeCloseTo(0, 15);
        expect(basis.up.z).toBeCloseTo(0, 15);
        const ecef = frame.enuToEcef({ x: 10, y: 20, z: 30 });
        expect(ecef).toEqual({ x: Ellipsoid.WGS84.semiMajorAxis + 30, y: 10, z: 20 });
        expect(frame.ecefToEnu(ecef)).toEqual({ x: 10, y: 20, z: 30 });
        expect(frame.ecefToNed(ecef)).toEqual({ x: 20, y: 10, z: -30 });
        expect(frame.nedToEcef({ x: 20, y: 10, z: -30 })).toEqual(ecef);
    });

    it("publishes column-major ENU and NED matrices equivalent to direct conversion", () => {
        const frame = GeodeticSystem.WGS84.createLocalTangentPlaneDegrees(45, 3, 100);
        const enu = { x: 500, y: -300, z: 80 };
        const ned = { x: enu.y, y: enu.x, z: -enu.z };
        const ecef = frame.enuToEcef(enu);

        const matrixLocal = applyMatrix(frame.ecefToEnuMatrix, ecef);
        expect(matrixLocal.x).toBeCloseTo(enu.x, 8);
        expect(matrixLocal.y).toBeCloseTo(enu.y, 8);
        expect(matrixLocal.z).toBeCloseTo(enu.z, 8);

        const matrixEcef = applyMatrix(frame.enuToEcefMatrix, enu);
        expect(matrixEcef.x).toBeCloseTo(ecef.x, 8);
        expect(matrixEcef.y).toBeCloseTo(ecef.y, 8);
        expect(matrixEcef.z).toBeCloseTo(ecef.z, 8);

        const matrixNed = applyMatrix(frame.ecefToNedMatrix, ecef);
        expect(matrixNed.x).toBeCloseTo(ned.x, 8);
        expect(matrixNed.y).toBeCloseTo(ned.y, 8);
        expect(matrixNed.z).toBeCloseTo(ned.z, 8);

        const matrixEcefFromNed = applyMatrix(frame.nedToEcefMatrix, ned);
        expect(matrixEcefFromNed.x).toBeCloseTo(ecef.x, 8);
        expect(matrixEcefFromNed.y).toBeCloseTo(ecef.y, 8);
        expect(matrixEcefFromNed.z).toBeCloseTo(ecef.z, 8);
    });

    it("returns defensive copies of its tangent basis and matrices", () => {
        const frame = GeodeticSystem.WGS84.createLocalTangentPlaneDegrees(10, 20, 30);
        const basis = frame.basis;
        const matrix = frame.ecefToNedMatrix;
        basis.up.x = 999;
        matrix[0] = 999;

        expect(frame.basis.up.x).not.toBe(999);
        expect(frame.ecefToNedMatrix[0]).not.toBe(999);
    });

    it("round trips geodetic coordinates through a local frame", () => {
        const frame = GeodeticSystem.WGS84.createLocalTangentPlaneDegrees(48.8566, 2.3522, 35);
        const local = frame.geodeticDegreesToEnu(48.857, 2.353, 70);
        const geodetic = frame.enuToGeodeticDegrees(local);
        expect(geodetic.latitude).toBeCloseTo(48.857, 9);
        expect(geodetic.longitude).toBeCloseTo(2.353, 9);
        expect(geodetic.height).toBeCloseTo(70, 5);
    });
});
