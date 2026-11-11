/**
 * Stars for a finished level. Kids always get at least one star for opening
 * the picture; more stars for keeping the hearts.
 *  - no hits: 3 stars
 *  - one hit: 2 stars
 *  - more: 1 star
 */
export function starsFor(hits: number): 1 | 2 | 3 {
  if (hits <= 0) return 3;
  if (hits === 1) return 2;
  return 1;
}

export function totalStars(stars: Readonly<Record<string, number>>, ids: readonly string[]): number {
  let sum = 0;
  for (const id of ids) sum += Math.max(0, Math.min(3, stars[id] ?? 0));
  return sum;
}
