/**
 * Generate a new entry id: YYYY-MM-DD-<project-slug>-<6-char-hex-random>.
 *
 * The random suffix is 6 lowercase hex chars (24 bits) — enough to avoid
 * collisions at any realistic logging rate for one consultant per month
 * (birthday-paradox math: ~4000 entries in one month before 1% collision).
 */
export function newEntryId(args: { date: string; projectSlug: string }): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${args.date}-${args.projectSlug}-${hex}`;
}
