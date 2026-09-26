import { normalizeLongitudeRadians, toDegrees, toRadians } from "./angles";
import { Ellipsoid } from "./ellipsoid";
import type { ICartesian3, IGeodeticCoordinates, ILocalTangentBasis } from "./types";

const POLE_EPSILON = 1e-12;
const CONVERGENCE_EPSILON = 1e-14;
const MAX_GEODETIC_ITERATIONS = 10;

function cartesianTarget(target?: ICartesian3): ICartesian3 {
    return target ?? { x: 0, y: 0, z: 0 };
}

function geodeticTarget(target?: IGeodeticCoordinates): IGeodeticCoordinates {
    return target ?? { latitude: 0, longitude: 0, height: 0 };
}

function validateGeodetic(latitudeRadians: number, longitudeRadians: number, height: number): void {
    if (!Number.isFinite(latitudeRadians) || latitudeRadians < -Math.PI / 2 || latitudeRadians > Math.PI / 2) {
        throw new RangeError("Geodetic latitude must be a finite value in the interval [-PI/2, PI/2].");
    }
    if (!Number.isFinite(longitudeRadians)) throw new RangeError("Geodetic longitude must be finite.");
    if (!Number.isFinite(height)) throw new RangeError("Ellipsoidal height must be finite.");
}

function validateCartesian(position: ICartesian3): void {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
        throw new RangeError("Cartesian coordinates must be finite.");
    }
}

function dot(left: ICartesian3, right: ICartesian3): number {
    return left.x * right.x + left.y * right.y + left.z * right.z;
}

/**
 * Immutable geodetic reference system backed by one reference ellipsoid.
 *
 * ECEF follows EPSG:4978 axis conventions: X crosses latitude 0 and longitude
 * 0, Y crosses latitude 0 and longitude 90 degrees east, and Z crosses the
 * north pole. Cartesian distances and ellipsoidal heights are expressed in
 * metres.
 */
export class GeodeticSystem {
    /** Shared WGS84 geodetic system. The instance is immutable. */
    public static readonly WGS84 = new GeodeticSystem(Ellipsoid.WGS84);

    /**
     * Creates a geodetic system.
     *
     * @param ellipsoid - Reference ellipsoid. Defaults to WGS84.
     */
    public constructor(public readonly ellipsoid: Ellipsoid = Ellipsoid.WGS84) {}

    /**
     * Converts geodetic coordinates in radians to ECEF.
     *
     * @param latitudeRadians - Geodetic latitude in radians.
     * @param longitudeRadians - Longitude in radians east of the reference meridian.
     * @param height - Ellipsoidal height in metres.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with ECEF metres.
     */
    public geodeticRadiansToEcef(latitudeRadians: number, longitudeRadians: number, height = 0, target?: ICartesian3): ICartesian3 {
        validateGeodetic(latitudeRadians, longitudeRadians, height);
        const output = cartesianTarget(target);
        const sineLatitude = Math.sin(latitudeRadians);
        const cosineLatitude = Math.cos(latitudeRadians);
        const cosineLongitude = Math.cos(longitudeRadians);
        const sineLongitude = Math.sin(longitudeRadians);
        const primeVerticalRadius = this.ellipsoid.primeVerticalRadius(latitudeRadians);
        const horizontalRadius = (primeVerticalRadius + height) * cosineLatitude;
        output.x = horizontalRadius * cosineLongitude;
        output.y = horizontalRadius * sineLongitude;
        output.z = (primeVerticalRadius * this.ellipsoid.oneMinusSquaredEccentricity + height) * sineLatitude;
        return output;
    }

    /**
     * Converts geodetic coordinates in degrees to ECEF.
     *
     * @param latitudeDegrees - Geodetic latitude in degrees.
     * @param longitudeDegrees - Longitude in degrees east of the reference meridian.
     * @param height - Ellipsoidal height in metres.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns The target populated with ECEF metres.
     */
    public geodeticDegreesToEcef(latitudeDegrees: number, longitudeDegrees: number, height = 0, target?: ICartesian3): ICartesian3 {
        return this.geodeticRadiansToEcef(toRadians(latitudeDegrees), toRadians(longitudeDegrees), height, target);
    }

    /**
     * Converts ECEF coordinates to geodetic coordinates in radians.
     *
     * Bowring initialization followed by a bounded fixed-point refinement gives
     * stable results at the equator, at the poles, below the ellipsoid and at
     * orbital altitudes. The ellipsoid centre is rejected because it has no
     * unique latitude or longitude.
     *
     * @param position - ECEF coordinate in metres.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns Geodetic latitude and longitude in radians, with height in metres.
     */
    public ecefToGeodeticRadians(position: ICartesian3, target?: IGeodeticCoordinates): IGeodeticCoordinates {
        validateCartesian(position);
        const output = geodeticTarget(target);
        const { x, y, z } = position;
        const distanceFromAxis = Math.hypot(x, y);
        if (distanceFromAxis < POLE_EPSILON) {
            if (Math.abs(z) < POLE_EPSILON) throw new RangeError("The ellipsoid centre has no unique geodetic coordinate.");
            output.latitude = z > 0 ? Math.PI / 2 : -Math.PI / 2;
            output.longitude = 0;
            output.height = Math.abs(z) - this.ellipsoid.semiMinorAxis;
            return output;
        }

        const major = this.ellipsoid.semiMajorAxis;
        const minor = this.ellipsoid.semiMinorAxis;
        const eccentricitySquared = this.ellipsoid.squaredEccentricity;
        const secondEccentricitySquared = this.ellipsoid.secondSquaredEccentricity;
        const longitude = Math.atan2(y, x);
        const bowringAngle = Math.atan2(z * major, distanceFromAxis * minor);
        const sineBowring = Math.sin(bowringAngle);
        const cosineBowring = Math.cos(bowringAngle);
        let latitude = Math.atan2(
            z + secondEccentricitySquared * minor * sineBowring ** 3,
            distanceFromAxis - eccentricitySquared * major * cosineBowring ** 3,
        );

        let height = 0;
        for (let iteration = 0; iteration < MAX_GEODETIC_ITERATIONS; iteration++) {
            const sineLatitude = Math.sin(latitude);
            const cosineLatitude = Math.cos(latitude);
            const primeVerticalRadius = this.ellipsoid.primeVerticalRadius(latitude);
            height =
                Math.abs(cosineLatitude) > 1e-10
                    ? distanceFromAxis / cosineLatitude - primeVerticalRadius
                    : z / sineLatitude - primeVerticalRadius * this.ellipsoid.oneMinusSquaredEccentricity;
            const denominator = 1 - (eccentricitySquared * primeVerticalRadius) / (primeVerticalRadius + height);
            const nextLatitude = Math.atan2(z, distanceFromAxis * denominator);
            if (Math.abs(nextLatitude - latitude) <= CONVERGENCE_EPSILON) {
                latitude = nextLatitude;
                break;
            }
            latitude = nextLatitude;
        }

        const sineLatitude = Math.sin(latitude);
        const cosineLatitude = Math.cos(latitude);
        const primeVerticalRadius = this.ellipsoid.primeVerticalRadius(latitude);
        height =
            Math.abs(cosineLatitude) > 1e-10
                ? distanceFromAxis / cosineLatitude - primeVerticalRadius
                : z / sineLatitude - primeVerticalRadius * this.ellipsoid.oneMinusSquaredEccentricity;

        output.latitude = latitude;
        output.longitude = normalizeLongitudeRadians(longitude);
        output.height = height;
        return output;
    }

    /**
     * Converts ECEF coordinates to geodetic coordinates in degrees.
     *
     * @param position - ECEF coordinate in metres.
     * @param target - Optional mutable output object, used to avoid an allocation.
     * @returns Geodetic latitude and longitude in degrees, with height in metres.
     */
    public ecefToGeodeticDegrees(position: ICartesian3, target?: IGeodeticCoordinates): IGeodeticCoordinates {
        const output = this.ecefToGeodeticRadians(position, target);
        output.latitude = toDegrees(output.latitude);
        output.longitude = toDegrees(output.longitude);
        return output;
    }

    /**
     * Returns the outward ellipsoid-normal unit vector at geodetic coordinates.
     *
     * @param latitudeRadians - Geodetic latitude in radians.
     * @param longitudeRadians - Longitude in radians.
     * @param target - Optional mutable output object.
     * @returns Unit vector expressed in ECEF axes.
     */
    public geodeticSurfaceNormalRadians(latitudeRadians: number, longitudeRadians: number, target?: ICartesian3): ICartesian3 {
        validateGeodetic(latitudeRadians, longitudeRadians, 0);
        const output = cartesianTarget(target);
        const cosineLatitude = Math.cos(latitudeRadians);
        output.x = cosineLatitude * Math.cos(longitudeRadians);
        output.y = cosineLatitude * Math.sin(longitudeRadians);
        output.z = Math.sin(latitudeRadians);
        return output;
    }

    /**
     * Returns the outward ellipsoid-normal unit vector at geodetic coordinates.
     *
     * @param latitudeDegrees - Geodetic latitude in degrees.
     * @param longitudeDegrees - Longitude in degrees.
     * @param target - Optional mutable output object.
     * @returns Unit vector expressed in ECEF axes.
     */
    public geodeticSurfaceNormalDegrees(latitudeDegrees: number, longitudeDegrees: number, target?: ICartesian3): ICartesian3 {
        return this.geodeticSurfaceNormalRadians(toRadians(latitudeDegrees), toRadians(longitudeDegrees), target);
    }

    /**
     * Creates an immutable local east, north, up tangent plane.
     *
     * @param latitudeRadians - Origin geodetic latitude in radians.
     * @param longitudeRadians - Origin longitude in radians.
     * @param height - Origin ellipsoidal height in metres.
     * @returns A local tangent plane bound to this geodetic system.
     */
    public createLocalTangentPlaneRadians(latitudeRadians: number, longitudeRadians: number, height = 0): LocalTangentPlane {
        return new LocalTangentPlane(this, { latitude: latitudeRadians, longitude: longitudeRadians, height });
    }

    /**
     * Creates an immutable local east, north, up tangent plane.
     *
     * @param latitudeDegrees - Origin geodetic latitude in degrees.
     * @param longitudeDegrees - Origin longitude in degrees.
     * @param height - Origin ellipsoidal height in metres.
     * @returns A local tangent plane bound to this geodetic system.
     */
    public createLocalTangentPlaneDegrees(latitudeDegrees: number, longitudeDegrees: number, height = 0): LocalTangentPlane {
        return this.createLocalTangentPlaneRadians(toRadians(latitudeDegrees), toRadians(longitudeDegrees), height);
    }
}

/**
 * Immutable local tangent plane anchored to a geodetic coordinate.
 *
 * ENU axes are X east, Y north and Z up. NED axes are X north, Y east and Z
 * down. All local values are metres. The stored matrices use column-major
 * order and multiply column vectors, matching glTF and 3D Tiles transforms.
 */
export class LocalTangentPlane {
    private readonly origin: IGeodeticCoordinates;
    private readonly originCartesian: ICartesian3;
    private readonly tangentBasis: ILocalTangentBasis;
    private readonly toEnu: Float64Array;
    private readonly fromEnu: Float64Array;
    private readonly toNed: Float64Array;
    private readonly fromNed: Float64Array;

    /**
     * Creates a local tangent plane.
     *
     * Prefer {@link GeodeticSystem.createLocalTangentPlaneRadians} or
     * {@link GeodeticSystem.createLocalTangentPlaneDegrees}, which make the
     * angular unit explicit at the call site.
     *
     * @param system - Geodetic reference system.
     * @param originRadians - Origin with angular components in radians.
     */
    public constructor(
        public readonly system: GeodeticSystem,
        originRadians: IGeodeticCoordinates,
    ) {
        validateGeodetic(originRadians.latitude, originRadians.longitude, originRadians.height);
        this.origin = { ...originRadians, longitude: normalizeLongitudeRadians(originRadians.longitude) };
        this.originCartesian = system.geodeticRadiansToEcef(this.origin.latitude, this.origin.longitude, this.origin.height);
        const sineLatitude = Math.sin(this.origin.latitude);
        const cosineLatitude = Math.cos(this.origin.latitude);
        const sineLongitude = Math.sin(this.origin.longitude);
        const cosineLongitude = Math.cos(this.origin.longitude);
        this.tangentBasis = {
            east: { x: -sineLongitude, y: cosineLongitude, z: 0 },
            north: {
                x: -sineLatitude * cosineLongitude,
                y: -sineLatitude * sineLongitude,
                z: cosineLatitude,
            },
            up: {
                x: cosineLatitude * cosineLongitude,
                y: cosineLatitude * sineLongitude,
                z: sineLatitude,
            },
        };
        const { east, north, up } = this.tangentBasis;
        this.toEnu = new Float64Array([
            east.x,
            north.x,
            up.x,
            0,
            east.y,
            north.y,
            up.y,
            0,
            east.z,
            north.z,
            up.z,
            0,
            -dot(east, this.originCartesian),
            -dot(north, this.originCartesian),
            -dot(up, this.originCartesian),
            1,
        ]);
        this.fromEnu = new Float64Array([
            east.x,
            east.y,
            east.z,
            0,
            north.x,
            north.y,
            north.z,
            0,
            up.x,
            up.y,
            up.z,
            0,
            this.originCartesian.x,
            this.originCartesian.y,
            this.originCartesian.z,
            1,
        ]);
        this.toNed = new Float64Array([
            north.x,
            east.x,
            -up.x,
            0,
            north.y,
            east.y,
            -up.y,
            0,
            north.z,
            east.z,
            -up.z,
            0,
            -dot(north, this.originCartesian),
            -dot(east, this.originCartesian),
            dot(up, this.originCartesian),
            1,
        ]);
        this.fromNed = new Float64Array([
            north.x,
            north.y,
            north.z,
            0,
            east.x,
            east.y,
            east.z,
            0,
            -up.x,
            -up.y,
            -up.z,
            0,
            this.originCartesian.x,
            this.originCartesian.y,
            this.originCartesian.z,
            1,
        ]);
    }

    /** Origin geodetic coordinate with latitude and longitude in radians. */
    public get originRadians(): IGeodeticCoordinates {
        return { ...this.origin };
    }

    /** Origin geodetic coordinate with latitude and longitude in degrees. */
    public get originDegrees(): IGeodeticCoordinates {
        return {
            latitude: toDegrees(this.origin.latitude),
            longitude: toDegrees(this.origin.longitude),
            height: this.origin.height,
        };
    }

    /** Origin expressed as ECEF metres. */
    public get originEcef(): ICartesian3 {
        return { ...this.originCartesian };
    }

    /** Canonical east, north and up tangent basis expressed as ECEF unit vectors. */
    public get basis(): ILocalTangentBasis {
        return {
            east: { ...this.tangentBasis.east },
            north: { ...this.tangentBasis.north },
            up: { ...this.tangentBasis.up },
        };
    }

    /** Column-major matrix transforming ECEF positions to ENU positions. */
    public get ecefToEnuMatrix(): Float64Array {
        return new Float64Array(this.toEnu);
    }

    /** Column-major matrix transforming ENU positions to ECEF positions. */
    public get enuToEcefMatrix(): Float64Array {
        return new Float64Array(this.fromEnu);
    }

    /** Column-major matrix transforming ECEF positions to NED positions. */
    public get ecefToNedMatrix(): Float64Array {
        return new Float64Array(this.toNed);
    }

    /** Column-major matrix transforming NED positions to ECEF positions. */
    public get nedToEcefMatrix(): Float64Array {
        return new Float64Array(this.fromNed);
    }

    /**
     * Converts an ECEF position to local ENU metres.
     *
     * @param position - ECEF position in metres.
     * @param target - Optional mutable output object.
     * @returns Local coordinate with X east, Y north and Z up.
     */
    public ecefToEnu(position: ICartesian3, target?: ICartesian3): ICartesian3 {
        validateCartesian(position);
        const output = cartesianTarget(target);
        const delta = {
            x: position.x - this.originCartesian.x,
            y: position.y - this.originCartesian.y,
            z: position.z - this.originCartesian.z,
        };
        output.x = dot(this.tangentBasis.east, delta);
        output.y = dot(this.tangentBasis.north, delta);
        output.z = dot(this.tangentBasis.up, delta);
        return output;
    }

    /**
     * Converts a local ENU position to ECEF metres.
     *
     * @param position - Local coordinate with X east, Y north and Z up.
     * @param target - Optional mutable output object.
     * @returns ECEF coordinate in metres.
     */
    public enuToEcef(position: ICartesian3, target?: ICartesian3): ICartesian3 {
        validateCartesian(position);
        const output = cartesianTarget(target);
        output.x =
            this.originCartesian.x +
            this.tangentBasis.east.x * position.x +
            this.tangentBasis.north.x * position.y +
            this.tangentBasis.up.x * position.z;
        output.y =
            this.originCartesian.y +
            this.tangentBasis.east.y * position.x +
            this.tangentBasis.north.y * position.y +
            this.tangentBasis.up.y * position.z;
        output.z =
            this.originCartesian.z +
            this.tangentBasis.east.z * position.x +
            this.tangentBasis.north.z * position.y +
            this.tangentBasis.up.z * position.z;
        return output;
    }

    /**
     * Converts an ECEF position to local NED metres.
     *
     * @param position - ECEF position in metres.
     * @param target - Optional mutable output object.
     * @returns Local coordinate with X north, Y east and Z down.
     */
    public ecefToNed(position: ICartesian3, target?: ICartesian3): ICartesian3 {
        validateCartesian(position);
        const output = cartesianTarget(target);
        const delta = {
            x: position.x - this.originCartesian.x,
            y: position.y - this.originCartesian.y,
            z: position.z - this.originCartesian.z,
        };
        output.x = dot(this.tangentBasis.north, delta);
        output.y = dot(this.tangentBasis.east, delta);
        output.z = -dot(this.tangentBasis.up, delta);
        return output;
    }

    /**
     * Converts a local NED position to ECEF metres.
     *
     * @param position - Local coordinate with X north, Y east and Z down.
     * @param target - Optional mutable output object.
     * @returns ECEF coordinate in metres.
     */
    public nedToEcef(position: ICartesian3, target?: ICartesian3): ICartesian3 {
        validateCartesian(position);
        const output = cartesianTarget(target);
        output.x =
            this.originCartesian.x +
            this.tangentBasis.north.x * position.x +
            this.tangentBasis.east.x * position.y -
            this.tangentBasis.up.x * position.z;
        output.y =
            this.originCartesian.y +
            this.tangentBasis.north.y * position.x +
            this.tangentBasis.east.y * position.y -
            this.tangentBasis.up.y * position.z;
        output.z =
            this.originCartesian.z +
            this.tangentBasis.north.z * position.x +
            this.tangentBasis.east.z * position.y -
            this.tangentBasis.up.z * position.z;
        return output;
    }

    /**
     * Converts geodetic radians directly to local ENU metres.
     *
     * @param latitudeRadians - Geodetic latitude in radians.
     * @param longitudeRadians - Longitude in radians.
     * @param height - Ellipsoidal height in metres.
     * @param target - Optional mutable output object.
     * @returns Local coordinate with X east, Y north and Z up.
     */
    public geodeticRadiansToEnu(latitudeRadians: number, longitudeRadians: number, height = 0, target?: ICartesian3): ICartesian3 {
        return this.ecefToEnu(this.system.geodeticRadiansToEcef(latitudeRadians, longitudeRadians, height), target);
    }

    /**
     * Converts geodetic degrees directly to local ENU metres.
     *
     * @param latitudeDegrees - Geodetic latitude in degrees.
     * @param longitudeDegrees - Longitude in degrees.
     * @param height - Ellipsoidal height in metres.
     * @param target - Optional mutable output object.
     * @returns Local coordinate with X east, Y north and Z up.
     */
    public geodeticDegreesToEnu(latitudeDegrees: number, longitudeDegrees: number, height = 0, target?: ICartesian3): ICartesian3 {
        return this.ecefToEnu(this.system.geodeticDegreesToEcef(latitudeDegrees, longitudeDegrees, height), target);
    }

    /**
     * Converts local ENU metres directly to geodetic radians.
     *
     * @param position - Local coordinate with X east, Y north and Z up.
     * @param target - Optional mutable output object.
     * @returns Geodetic latitude and longitude in radians, with height in metres.
     */
    public enuToGeodeticRadians(position: ICartesian3, target?: IGeodeticCoordinates): IGeodeticCoordinates {
        return this.system.ecefToGeodeticRadians(this.enuToEcef(position), target);
    }

    /**
     * Converts local ENU metres directly to geodetic degrees.
     *
     * @param position - Local coordinate with X east, Y north and Z up.
     * @param target - Optional mutable output object.
     * @returns Geodetic latitude and longitude in degrees, with height in metres.
     */
    public enuToGeodeticDegrees(position: ICartesian3, target?: IGeodeticCoordinates): IGeodeticCoordinates {
        return this.system.ecefToGeodeticDegrees(this.enuToEcef(position), target);
    }
}
