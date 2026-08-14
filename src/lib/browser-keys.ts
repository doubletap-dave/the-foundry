import { PROVIDER_IDS, type KeyStatus, type Provider } from "@/lib/models";
import type { RequestKeys } from "@/lib/keys";

export const KEYS_STORE = "foundry.keys";

export function readBrowserKeys(): RequestKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEYS_STORE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: RequestKeys = {};
    for (const id of PROVIDER_IDS) {
      const v = (parsed as Record<string, unknown>)[id];
      if (typeof v === "string" && v.trim()) out[id] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function writeBrowserKeys(keys: RequestKeys): void {
  if (typeof window === "undefined") return;
  const clean: RequestKeys = {};
  for (const id of PROVIDER_IDS) {
    const v = keys[id];
    if (typeof v === "string" && v.trim()) clean[id] = v.trim();
  }
  if (Object.keys(clean).length === 0) {
    localStorage.removeItem(KEYS_STORE);
    return;
  }
  localStorage.setItem(KEYS_STORE, JSON.stringify(clean));
}

export function browserHasKeys(): boolean {
  return Object.keys(readBrowserKeys()).length > 0;
}

export function mergeKeyStatus(local: RequestKeys, sqlite: KeyStatus[]): KeyStatus[] {
  return PROVIDER_IDS.map((id) => {
    const lk = local[id];
    if (lk) return { provider: id, set: true, last4: lk.slice(-4) };
    const row = sqlite.find((s) => s.provider === id);
    return row ?? { provider: id, set: false, last4: "" };
  });
}

export type { RequestKeys };
