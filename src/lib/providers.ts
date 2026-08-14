import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modelConfigs, providerKeys } from "@/db/schema";
import { id } from "@/lib/ids";
import { keyFor } from "@/lib/keys-context";
import {
  PERPLEXITY_FALLBACK,
  PROVIDERS,
  defaultModelFor,
  providerLabel,
  type CatalogEntry,
  type KeyStatus,
  type Provider,
} from "@/lib/models";

export type { KeyStatus };

export const PROVIDER_META: Record<
  Provider,
  { label: string; baseURL: string; modelsURLs: string[] }
> = {
  openai: {
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    modelsURLs: ["https://api.openai.com/v1/models"],
  },
  grok: {
    label: "Grok",
    baseURL: "https://api.x.ai/v1",
    modelsURLs: ["https://api.x.ai/v1/models"],
  },
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    modelsURLs: ["https://openrouter.ai/api/v1/models"],
  },
  perplexity: {
    label: "Perplexity",
    baseURL: "https://api.perplexity.ai",
    modelsURLs: [
      "https://api.perplexity.ai/models",
      "https://api.perplexity.ai/v1/models",
    ],
  },
};

export function sanitizeError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  msg = msg.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  msg = msg.replace(/\bsk-[a-zA-Z0-9_-]+\b/g, "[redacted]");
  msg = msg.replace(/\bxai-[a-zA-Z0-9_-]+\b/g, "[redacted]");
  msg = msg.replace(/\bpplx-[a-zA-Z0-9_-]+\b/g, "[redacted]");
  return msg.replace(/\s+/g, " ").trim().slice(0, 280);
}

function readSqliteKey(provider: Provider): string | null {
  const row = db
    .select({ key: providerKeys.key })
    .from(providerKeys)
    .where(eq(providerKeys.provider, provider))
    .get();
  const key = row?.key?.trim();
  return key ? key : null;
}

/** Request bag first (AsyncLocalStorage), then SQLite fallback for Dave's local key. */
export function readKey(provider: Provider): string | null {
  const fromReq = keyFor(provider);
  if (fromReq) return fromReq;
  return readSqliteKey(provider);
}

/** SQLite only — server fallback. Client checks localStorage itself. */
export function hasAnyKey(): boolean {
  try {
    const rows = db.select({ provider: providerKeys.provider }).from(providerKeys).all();
    return rows.length > 0;
  } catch {
    return false;
  }
}

export function listKeyStatuses(): KeyStatus[] {
  return PROVIDERS.map((p) => {
    const row = db
      .select({ key: providerKeys.key })
      .from(providerKeys)
      .where(eq(providerKeys.provider, p.id))
      .get();
    if (!row?.key) return { provider: p.id, set: false, last4: "" };
    const key = row.key;
    return { provider: p.id, set: true, last4: key.slice(-4) };
  });
}

export function upsertKey(provider: Provider, raw: string): void {
  const key = raw.trim();
  if (!key) throw new Error("Paste a key.");
  const now = new Date();
  const existing = db
    .select({ id: providerKeys.id })
    .from(providerKeys)
    .where(eq(providerKeys.provider, provider))
    .get();
  if (existing) {
    db.update(providerKeys)
      .set({ key, updatedAt: now })
      .where(eq(providerKeys.id, existing.id))
      .run();
  } else {
    db.insert(providerKeys)
      .values({ id: id("key"), provider, key, updatedAt: now })
      .run();
  }

  if (provider === "perplexity") {
    const scout = db.select().from(modelConfigs).where(eq(modelConfigs.role, "scout")).get();
    const stillDefault =
      !scout || (scout.provider === "openai" && scout.model === "gpt-4.1-mini");
    if (stillDefault) {
      if (scout) {
        db.update(modelConfigs)
          .set({ provider: "perplexity", model: "sonar-pro", updatedAt: now })
          .where(eq(modelConfigs.id, scout.id))
          .run();
      } else {
        db.insert(modelConfigs)
          .values({
            id: id("model"),
            role: "scout",
            provider: "perplexity",
            model: "sonar-pro",
            updatedAt: now,
          })
          .run();
      }
    }
  }
}

export function deleteKey(provider: Provider): void {
  db.delete(providerKeys).where(eq(providerKeys.provider, provider)).run();
}

type CacheRow = { at: number; models: CatalogEntry[] };
const catalogCache = new Map<Provider, CacheRow>();
const CATALOG_TTL_MS = 10 * 60 * 1000;

function isOpenAIChat(modelId: string): boolean {
  const x = modelId.toLowerCase();
  if (
    /whisper|tts|dall-e|dalle|embedding|audio|transcrib|realtime|image|moderation|sora|babbage|davinci|codex|computer-use/.test(
      x,
    )
  ) {
    return false;
  }
  return /gpt-|o1|o3|o4|chatgpt-/.test(x);
}

function sortOpenAI(ids: string[]): string[] {
  const rank = (id: string) => {
    const x = id.toLowerCase();
    if (x.startsWith("gpt-4.1") && !x.includes("mini") && !x.includes("nano")) return 0;
    if (x.startsWith("gpt-4.1")) return 1;
    if (x.startsWith("gpt-4o") && !x.includes("mini")) return 2;
    if (x.startsWith("gpt-4o")) return 3;
    if (x.startsWith("o4")) return 4;
    if (x.startsWith("o3")) return 5;
    if (x.startsWith("o1")) return 6;
    if (x.startsWith("chatgpt-")) return 7;
    return 20;
  };
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function sortGrok(ids: string[]): string[] {
  const rank = (id: string) => {
    const x = id.toLowerCase();
    if (x.includes("grok-3") && !x.includes("mini")) return 0;
    if (x.includes("grok-3")) return 1;
    if (x.includes("grok-2")) return 2;
    return 10;
  };
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function sortPerplexity(ids: string[]): string[] {
  const order = ["sonar-pro", "sonar-reasoning-pro", "sonar-deep-research", "sonar"];
  return [...ids].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 50 : ia) - (ib === -1 ? 50 : ib) || a.localeCompare(b);
  });
}

function extractModelIds(payload: unknown): { id: string; label: string }[] {
  const bag: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { data?: unknown; models?: unknown }).data as unknown[]) ??
        ((payload as { models?: unknown }).models as unknown[]) ??
        []
      : [];
  const out: { id: string; label: string }[] = [];
  for (const item of bag) {
    if (typeof item === "string") {
      out.push({ id: item, label: item });
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as { id?: unknown; name?: unknown };
      const mid = typeof rec.id === "string" ? rec.id : null;
      if (!mid) continue;
      const label = typeof rec.name === "string" && rec.name ? rec.name : mid;
      out.push({ id: mid, label });
    }
  }
  return out;
}

function authHeaders(provider: Provider, key: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "The Foundry";
  }
  return headers;
}

async function hitModels(url: string, provider: Provider, key: string): Promise<unknown> {
  const res = await fetch(url, { headers: authHeaders(provider, key), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${providerLabel(provider)} models ${res.status}`);
  }
  return res.json();
}

export async function fetchCatalog(
  provider: Provider,
  force = false,
): Promise<CatalogEntry[]> {
  const cached = catalogCache.get(provider);
  if (!force && cached && Date.now() - cached.at < CATALOG_TTL_MS) {
    return cached.models;
  }

  const key = readKey(provider);
  if (!key) {
    return [];
  }

  const urls = PROVIDER_META[provider].modelsURLs;
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const payload = await hitModels(url, provider, key);
      let rows = extractModelIds(payload);
      if (provider === "openai") {
        rows = rows.filter((r) => isOpenAIChat(r.id));
        const sorted = sortOpenAI(rows.map((r) => r.id));
        rows = sorted.map((mid) => rows.find((r) => r.id === mid)!);
      } else if (provider === "grok") {
        const sorted = sortGrok(rows.map((r) => r.id));
        rows = sorted.map((mid) => rows.find((r) => r.id === mid)!);
      }
      let models: CatalogEntry[] = rows.map((r) => ({
        provider,
        id: r.id,
        label: r.label.includes("/") ? r.label.split("/").slice(-1)[0] : r.label,
        note: "live",
      }));
      if (provider === "perplexity") {
        const byId = new Map(models.map((m) => [m.id, m]));
        for (const fb of PERPLEXITY_FALLBACK) {
          if (!byId.has(fb.id)) byId.set(fb.id, fb);
        }
        const sorted = sortPerplexity([...byId.keys()]);
        models = sorted.map((mid) => byId.get(mid)!);
        if (models.length === 0) {
          const fallback = PERPLEXITY_FALLBACK;
          catalogCache.set(provider, { at: Date.now(), models: fallback });
          return fallback;
        }
      }
      catalogCache.set(provider, { at: Date.now(), models });
      return models;
    } catch (err) {
      lastErr = err;
    }
  }

  if (provider === "perplexity") {
    const fallback = PERPLEXITY_FALLBACK;
    catalogCache.set(provider, { at: Date.now(), models: fallback });
    return fallback;
  }

  throw new Error(sanitizeError(lastErr) || `Could not load ${providerLabel(provider)} catalog`);
}

export async function fetchAllCatalogs(
  force = false,
): Promise<Record<Provider, CatalogEntry[]>> {
  const out = {} as Record<Provider, CatalogEntry[]>;
  for (const p of PROVIDERS) {
    if (!readKey(p.id)) {
      out[p.id] = [];
      continue;
    }
    try {
      out[p.id] = await fetchCatalog(p.id, force);
    } catch {
      out[p.id] = [];
    }
  }
  return out;
}

export async function testProviderConnection(
  provider: Provider,
): Promise<{ ok: true } | { error: string }> {
  const key = readKey(provider);
  if (!key) return { error: `No ${providerLabel(provider)} key saved.` };
  try {
    const models = await fetchCatalog(provider, true);
    if (models.length === 0 && provider !== "perplexity") {
      return { error: "Key accepted but the catalog was empty." };
    }
    return { ok: true };
  } catch (err) {
    return { error: sanitizeError(err) };
  }
}

export function requireKey(provider: Provider): string {
  const key = readKey(provider);
  if (!key) {
    const label = providerLabel(provider);
    const article = /^[aeiou]/i.test(label) ? "an" : "a";
    throw new Error(`Add ${article} ${label} key.`);
  }
  return key;
}

export { defaultModelFor };
