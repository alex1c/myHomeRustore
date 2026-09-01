/**
 * Build brand/model subtitle for item details.
 */

export function buildBrandModelLine(
  brand: string | null,
  model: string | null,
): string | null {
  const parts = [brand, model].filter((p) => p && p.trim().length > 0) as string[];
  return parts.length > 0 ? parts.join(' ') : null;
}
