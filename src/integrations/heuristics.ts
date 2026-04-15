export const MINUTES_PER_UNIT = {
  slack: { client: 2, internal: 1 },
  email: { client: 3, internal: 1 },
} as const;

export function heuristicHoursHundredths(
  minutesPerUnit: number,
  count: number,
): number {
  return Math.max(1, Math.round((minutesPerUnit * count * 100) / 60));
}
