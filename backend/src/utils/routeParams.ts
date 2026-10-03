/** Parse a positive database ID without coercing wildcard arrays or partial numbers. */
export function parseRouteInteger(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return Number.NaN;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : Number.NaN;
}
