export type CalendarCell = {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Return a 42-cell (6 weeks × 7 days) grid for the given month, Mon-first.
 * Cells from adjacent months that pad the first/last week have inMonth: false.
 */
export function computeCalendarLayout(year: number, month1to12: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month1to12 - 1, 1);
  // JS getDay(): Sun=0, Mon=1, ..., Sat=6. Convert to Mon=0, ..., Sun=6.
  const firstDay = firstOfMonth.getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;

  const start = new Date(year, month1to12 - 1, 1 - mondayOffset);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      date: toISO(d),
      inMonth: d.getMonth() === month1to12 - 1 && d.getFullYear() === year,
    });
  }
  return cells;
}
