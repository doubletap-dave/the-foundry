import { AsyncLocalStorage } from "async_hooks";
import { sanitizeKeys, type RequestKeys } from "@/lib/keys";
import { PROVIDER_IDS, type Provider } from "@/lib/models";

export type ModelChoice = { provider: Provider; model: string };

type RequestBag = {
  keys: RequestKeys;
  choice?: ModelChoice;
};

const store = new AsyncLocalStorage<RequestBag>();

function cleanChoice(choice?: ModelChoice | null): ModelChoice | undefined {
  if (!choice) return undefined;
  if (!(PROVIDER_IDS as readonly string[]).includes(choice.provider)) return undefined;
  const model = typeof choice.model === "string" ? choice.model.trim() : "";
  if (!model) return undefined;
  return { provider: choice.provider, model };
}

export function runWithKeys<T>(
  keys: RequestKeys | undefined,
  fn: () => T,
  choice?: ModelChoice | null,
): T {
  return store.run({ keys: sanitizeKeys(keys), choice: cleanChoice(choice) }, fn);
}

export function keyFor(provider: Provider): string | null {
  const bag = store.getStore();
  const k = bag?.keys?.[provider];
  if (typeof k === "string" && k.trim()) return k.trim();
  return null;
}

export function hasRequestKeys(): boolean {
  const bag = store.getStore();
  if (!bag?.keys) return false;
  return Object.values(bag.keys).some((v) => typeof v === "string" && v.trim().length > 0);
}

export function requestedChoice(): ModelChoice | null {
  return store.getStore()?.choice ?? null;
}

export type { RequestKeys };
