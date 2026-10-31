import { describe, expect, it } from "vitest";

import { Ellipsoid, UtmProjection, epsgSystem, type IEpsgProjectedSystem } from "../src";

/** The projected system of a code, failing the test when it is unknown or geographic. */
function projected(code: number): IEpsgProjectedSystem {
    const system = epsgSystem(code);
    if (system?.kind !== "projected") throw new Error(`EPSG:${code} is not a projected system.`);
    return system;
}

describe("epsgSystem", () => {
    it("knows the geographic systems on WGS84 and GRS80", () => {
        for (const [code, ellipsoid] of [
            [4326, Ellipsoid.WGS84],
            [4269, Ellipsoid.GRS80],
            [4258, Ellipsoid.GRS80],
            [4619, Ellipsoid.GRS80],
        ] as const) {
            const system = epsgSystem(code);
            expect(system?.kind).toBe("geographic");
            expect(system?.ellipsoid).toBe(ellipsoid);
        }
    });

    it("maps SWEREF99 TM and ETRS-TM35FIN to UTM zones 33 and 35 on GRS80", () => {
        const sweref = projected(3006),
            finland = projected(3067);
        expect(sweref.name).toBe("SWEREF99 TM");
        expect(sweref.projection.geodeticDegreesToProjected(62, 15).easting).toBeCloseTo(500000, 6);
        expect(finland.projection.geodeticDegreesToProjected(62, 27).easting).toBeCloseTo(500000, 6);
        const reference = new UtmProjection(33, "N", Ellipsoid.GRS80).geodeticDegreesToProjected(67.85, 20.22);
        const kiruna = sweref.projection.geodeticDegreesToProjected(67.85, 20.22);
        expect(kiruna.easting).toBeCloseTo(reference.easting, 9);
        expect(kiruna.northing).toBeCloseTo(reference.northing, 9);
    });

    it("places the false origins of the local and national zones", () => {
        // SWEREF99 16 30: scale 1 and a false easting of 150 km on its meridian.
        expect(projected(3010).projection.geodeticDegreesToProjected(63, 16.5).easting).toBeCloseTo(150000, 6);
        // NAD83 MTM zone 8: meridian 73.5 W, false easting 304.8 km.
        expect(projected(32188).projection.geodeticDegreesToProjected(46, -73.5).easting).toBeCloseTo(304800, 6);
        // Lambert-93 at its origin, 3 E 46.5 N.
        const lambert = projected(2154).projection.geodeticDegreesToProjected(46.5, 3);
        expect(lambert.easting).toBeCloseTo(700000, 4);
        expect(lambert.northing).toBeCloseTo(6600000, 4);
        // Quebec Lambert at its origin, 68.5 W 44 N.
        const quebec = projected(32198).projection.geodeticDegreesToProjected(44, -68.5);
        expect(quebec.easting).toBeCloseTo(0, 4);
        expect(quebec.northing).toBeCloseTo(0, 4);
    });

    it("names UTM zones by datum and hemisphere", () => {
        expect(projected(32633).name).toBe("WGS 84 / UTM zone 33N");
        expect(projected(26918).ellipsoid).toBe(Ellipsoid.GRS80);
        expect(projected(25835).name).toBe("ETRS89 / UTM zone 35N");
        expect(projected(32733).projection.geodeticDegreesToProjected(0, 15).northing).toBeCloseTo(10000000, 6);
        expect(projected(3857).projection.geodeticDegreesToProjected(0, 0).easting).toBeCloseTo(0, 9);
    });

    it("leaves out unknown codes and systems on other datums", () => {
        expect(epsgSystem(3021)).toBeUndefined(); // RT90 2.5 gon V, on Bessel 1841
        expect(epsgSystem(4230)).toBeUndefined(); // ED50
        expect(epsgSystem(12.5)).toBeUndefined();
        expect(epsgSystem(3006)).toBe(epsgSystem(3006));
    });
});
