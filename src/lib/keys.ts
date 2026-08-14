import { PROVIDER_IDS, type Provider } from "@/lib/models";

export type RequestKeys = Partial<Record<Provider, string>>;

export function sanitizeKeys(keys: RequestKeys | null | undefined): RequestKeys {
  if (!keys) return {};
  const out: RequestKeys = {};
  for (const id of PROVIDER_IDS) {
    const v = keys[id];
    if (typeof v === "string" && v.trim()) out[id] = v.trim();
  }
  return out;
}

export function bagHasKey(keys: RequestKeys | null | undefined): boolean {
  return Object.keys(sanitizeKeys(keys)).length > 0;
}
