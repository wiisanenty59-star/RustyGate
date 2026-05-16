/**
 * Require a string parameter, throwing a 400-equivalent error if it's missing.
 */
export function requireString(value: string | undefined, name: string): string {
  if (value === undefined || value === null || value === "") {
    throw Object.assign(new Error(`Missing required parameter: ${name}`), { status: 400 });
  }
  return value;
}
