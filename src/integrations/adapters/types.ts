import type { EffortKind } from '@/schema/types';

export type SourceKind = 'calendar' | 'slack' | 'gmail';
export type DigestDirection = 'client' | 'internal' | 'ambiguous';

export interface DigestItem {
  readonly timestamp: string;
  readonly label: string;
  readonly externalId: string;
}

export interface DigestRow {
  readonly source: SourceKind;
  readonly direction: DigestDirection;
  readonly count: number;
  readonly heuristicHoursHundredths: number;
  readonly suggestedKind: EffortKind;
  readonly suggestedProjectId: string | null;
  readonly batchId: string;
  readonly items: readonly DigestItem[];
  readonly label: string;
}

export interface EffortSourceAdapter {
  readonly source: SourceKind;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  fetchDailyDigest(date: string): Promise<DigestRow[]>;
}
