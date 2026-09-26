/** Number of radians in one degree. */
export const DEGREES_TO_RADIANS = Math.PI / 180;

/** Number of degrees in one radian. */
export const RADIANS_TO_DEGREES = 180 / Math.PI;

/** Full turn in radians. */
export const TWO_PI = Math.PI * 2;

/**
 * Converts an angle from degrees to radians.
 *
 * @param degrees - Angle in degrees.
 * @returns The equivalent angle in radians.
 */
export function toRadians(degrees: number): number {
    return degrees * DEGREES_TO_RADIANS;
}

/**
 * Converts an angle from radians to degrees.
 *
 * @param radians - Angle in radians.
 * @returns The equivalent angle in degrees.
 */
export function toDegrees(radians: number): number {
    return radians * RADIANS_TO_DEGREES;
}

/**
 * Normalizes a longitude to the half-open interval `[-PI, PI)`.
 *
 * @param longitudeRadians - Longitude in radians.
 * @returns Normalized longitude in radians.
 */
export function normalizeLongitudeRadians(longitudeRadians: number): number {
    return ((((longitudeRadians + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
}

/**
 * Normalizes a longitude to the half-open interval `[-180, 180)`.
 *
 * @param longitudeDegrees - Longitude in degrees.
 * @returns Normalized longitude in degrees.
 */
export function normalizeLongitudeDegrees(longitudeDegrees: number): number {
    return ((((longitudeDegrees + 180) % 360) + 360) % 360) - 180;
}
