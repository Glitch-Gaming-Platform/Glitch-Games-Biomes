export function isUsableCursorRay(
  source: readonly number[],
  direction: readonly number[]
): boolean {
  return (
    source.length === 3 &&
    direction.length === 3 &&
    source.every(Number.isFinite) &&
    direction.every(Number.isFinite) &&
    direction.some((component) => Math.abs(component) > 1e-8)
  );
}
