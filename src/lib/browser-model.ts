import { PROVIDER_IDS, type Provider } from "@/lib/models";

export const MODEL_STORE = "foundry.model";

export type ModelChoice = { provider: Provider; model: string };

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

export function readBrowserModel(): ModelChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MODEL_STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as { provider?: unknown; model?: unknown };
    if (!isProvider(rec.provider) || typeof rec.model !== "string") return null;
    const model = rec.model.trim();
    if (!model) return null;
    return { provider: rec.provider, model };
  } catch {
    return null;
  }
}

export function writeBrowserModel(choice: ModelChoice): void {
  if (typeof window === "undefined") return;
  if (!isProvider(choice.provider)) return;
  const model = choice.model.trim();
  if (!model) return;
  localStorage.setItem(MODEL_STORE, JSON.stringify({ provider: choice.provider, model }));
  window.dispatchEvent(new Event("foundry-model"));
}
