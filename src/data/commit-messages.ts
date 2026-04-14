import { formatHoursDecimal, formatCents } from '@/format/format';

// Commit-message formatters use a currency-agnostic display so they embed in
// git logs without the partner suffix. The formatter here takes just the
// symbol; the display suffix is omitted on purpose.
const noSuffix = { currency_symbol: '$', currency_display_suffix: '' };

function formatDollars(cents: number): string {
  return formatCents(cents, noSuffix).trim();
}

// ─── log ───
export function logMessage(args: {
  project: string;
  date: string;
  hours_hundredths: number;
  rate_cents: number;
  description: string;
}): string {
  const hours = formatHoursDecimal(args.hours_hundredths);
  const rate = formatDollars(args.rate_cents);
  return `log: ${args.project} ${args.date} ${hours}h @ ${rate} (${args.description})`;
}

// ─── edit ───
export function editMessage(id: string, change: string): string {
  return `edit: ${id} — ${change}`;
}

export function deleteMessage(id: string, reason: string): string {
  return `delete: ${id} — ${reason}`;
}

export function bulkEditMessage(args: {
  rate_cents: number;
  count: number;
  filter: string;
}): string {
  return `bulk-edit: apply ${formatDollars(args.rate_cents)} rate to ${args.count} entries matching {${args.filter}}`;
}

// ─── config ───
export function configAddProjectMessage(name: string): string {
  return `config: add project "${name}"`;
}

export function configAddBucketMessage(bucketId: string, projectId: string): string {
  return `config: add bucket ${bucketId} to ${projectId}`;
}

export function configEditBucketMessage(args: {
  bucketId: string;
  projectId: string;
  changes: string[];
}): string {
  const body = args.changes.length > 0 ? args.changes.join(', ') : 'no field changes';
  return `config: edit bucket ${args.bucketId} in ${args.projectId} — ${body}`;
}

export function configAddRateMessage(rate_cents: number, effective_from: string): string {
  return `config: add rate ${formatDollars(rate_cents)} effective ${effective_from}`;
}

// ─── snapshot ───
export function snapshotCloseMessage(args: {
  month: string;
  billable_hours_hundredths: number;
  non_billable_hours_hundredths: number;
  billable_amount_cents: number;
}): string {
  const billable = formatHoursDecimal(args.billable_hours_hundredths);
  const nonBillable = formatHoursDecimal(args.non_billable_hours_hundredths);
  const amount = formatDollars(args.billable_amount_cents);
  return `snapshot: close ${args.month} — ${billable}h billable, ${nonBillable}h non-billable, ${amount}`;
}

// ─── import ───
export function importMessage(month: string, source: string, count: number): string {
  return `import: ${month} from ${source} (${count} entries)`;
}
