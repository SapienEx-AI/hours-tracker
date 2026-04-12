import type { Partner, PartnersIndex } from '@/schema/types';
import { validatePartner, formatValidationErrors } from '@/schema/validators';

// The Vite `base` config is '/hours-tracker/'. All fetches of static assets
// under public/ are prefixed with this base at build time via import.meta.env.
// During dev, import.meta.env.BASE_URL is '/hours-tracker/'.
function baseUrl(): string {
  const env = (import.meta as { env?: { BASE_URL?: string } }).env;
  return env?.BASE_URL ?? '/';
}

export async function loadPartnersIndex(): Promise<PartnersIndex> {
  const url = `${baseUrl()}partners/index.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load partners index from ${url} (status ${res.status})`);
  }
  const data = (await res.json()) as PartnersIndex;
  if (!data || !Array.isArray(data.partners)) {
    throw new Error(`Invalid partners index at ${url}: missing 'partners' array`);
  }
  return data;
}

export async function loadPartner(partnerId: string): Promise<Partner> {
  const url = `${baseUrl()}partners/${partnerId}/partner.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load partner "${partnerId}" from ${url} (status ${res.status})`);
  }
  const data = await res.json();
  const result = validatePartner(data);
  if (!result.ok) {
    throw new Error(
      `Partner "${partnerId}" failed schema validation:\n${formatValidationErrors(result.errors)}`,
    );
  }
  return result.value;
}
