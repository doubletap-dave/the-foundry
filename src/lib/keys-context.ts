import { AsyncLocalStorage } from "async_hooks";
import { sanitizeKeys, type RequestKeys } from "@/lib/keys";
import type { Provider } from "@/lib/models";

const store = new AsyncLocalStorage<RequestKeys>();

export function runWithKeys<T>(keys: RequestKeys | undefined, fn: () => T): T {
  return store.run(sanitizeKeys(keys), fn);
}

export function keyFor(provider: Provider): string | null {
  const bag = store.getStore();
  const k = bag?.[provider];
  if (typeof k === "string" && k.trim()) return k.trim();
  return null;
}

export function hasRequestKeys(): boolean {
  const bag = store.getStore();
  if (!bag) return false;
  return Object.values(bag).some((v) => typeof v === "string" && v.trim().length > 0);
}

export type { RequestKeys };
