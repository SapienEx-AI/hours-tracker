import type { Entry, EffortItem } from '@/schema/types';
import { formatHoursDecimal } from '@/format/format';

const HEADER = [
  'id', 'date', 'project', 'bucket', 'hours', 'rate',
  'billable_status', 'description', 'review_flag', 'rate_source',
  'effort',
].join(',');

function formatEffort(items: EffortItem[]): string {
  if (items.length === 0) return '';
  return [...items]
    .sort((a, b) => a.kind.localeCompare(b.kind))
    .map((it) => `${it.kind}:${it.count}`)
    .join(';');
}

const INJECTION_PREFIXES = ['=', '+', '-', '@'];

function rateDollarsDecimal(rateCents: number): string {
  const whole = Math.trunc(rateCents / 100);
  const frac = rateCents - whole * 100;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

function escapeCell(raw: string): string {
  let value = raw;
  if (value.length > 0 && INJECTION_PREFIXES.includes(value[0] ?? '')) {
    value = `'${value}`;
  }
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function entriesToCSV(entries: Entry[]): string {
  const rows = entries.map((e) => [
    e.id,
    e.date,
    e.project,
    e.bucket_id ?? '',
    formatHoursDecimal(e.hours_hundredths),
    rateDollarsDecimal(e.rate_cents),
    e.billable_status,
    e.description,
    e.review_flag ? 'true' : 'false',
    e.rate_source,
    formatEffort(e.effort),
  ].map(escapeCell).join(','));
  return [HEADER, ...rows].join('\n');
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
