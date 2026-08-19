import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { chatSampling, isFixedTemperatureError } from "@/lib/chat-params";
import { requestedChoice } from "@/lib/keys-context";
import {
  defaultModelFor,
  PROVIDER_IDS,
  providerLabel,
  type AgentRole,
  type Provider,
} from "@/lib/models";
import { listModelConfigs } from "@/lib/queries";
import {
  PROVIDER_META,
  readKey,
  requireKey,
  sanitizeError,
} from "@/lib/providers";

export type ResolvedModel = {
  provider: Provider;
  model: string;
};

function keyedProviders(): Provider[] {
  return PROVIDER_IDS.filter((id) => Boolean(readKey(id)));
}

function usable(row: { provider: string; model: string } | undefined): ResolvedModel | null {
  if (!row) return null;
  if (!(PROVIDER_IDS as readonly string[]).includes(row.provider)) return null;
  const provider = row.provider as Provider;
  if (!readKey(provider)) return null;
  const model = row.model?.trim();
  if (!model) return null;
  return { provider, model };
}

export function resolveRole(role: AgentRole): ResolvedModel {
  const choice = requestedChoice();
  const keyed = keyedProviders();

  // Web-grounded scout: Perplexity whenever that key exists.
  if (role === "scout" && readKey("perplexity")) {
    if (choice?.provider === "perplexity") {
      return { provider: "perplexity", model: choice.model };
    }
    return { provider: "perplexity", model: defaultModelFor("perplexity") };
  }

  // 1. Choice rides with the request (like keys), if that provider is keyed.
  if (choice && readKey(choice.provider)) {
    return { provider: choice.provider, model: choice.model };
  }

  // 2. sqlite default row if its provider has a key. Seed per-role OpenAI
  //    rows are not real overrides — ignore them unless that key exists.
  const configs = listModelConfigs();
  const def = usable(configs.find((c) => c.role === "default"));
  if (def) return def;
  const row = usable(configs.find((c) => c.role === role));
  if (row) return row;

  // 3. Infer from keys on this request.
  if (keyed.length === 1) {
    return { provider: keyed[0], model: defaultModelFor(keyed[0]) };
  }
  if (keyed.length > 1) {
    if (choice && keyed.includes(choice.provider)) {
      return {
        provider: choice.provider,
        model: choice.model || defaultModelFor(choice.provider),
      };
    }
    const live = keyed.find((id) => id !== "openai") ?? keyed[0];
    return { provider: live, model: defaultModelFor(live) };
  }

  // 4. Never return openai when there is no OpenAI key.
  throw new Error("No keys.");
}

export function makeChat(
  provider: Provider,
  model: string,
  apiKey: string,
  temperature?: number,
  baseURL = PROVIDER_META[provider].baseURL,
): ChatOpenAI {
  const configuration: {
    baseURL: string;
    defaultHeaders?: Record<string, string>;
  } = { baseURL };
  if (provider === "openrouter") {
    configuration.defaultHeaders = {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "The Foundry",
    };
  }
  const sampling =
    temperature === undefined ? {} : chatSampling(model, temperature);
  return new ChatOpenAI({
    apiKey,
    model,
    ...sampling,
    maxRetries: 1,
    timeout: 90_000,
    configuration,
  });
}

export function chatFor(role: AgentRole, temperature = 0.4): {
  llm: ChatOpenAI;
  provider: Provider;
  model: string;
} {
  const { provider, model } = resolveRole(role);
  const apiKey = requireKey(provider);
  return { llm: makeChat(provider, model, apiKey, temperature), provider, model };
}

function messageText(res: unknown): string {
  if (!res || typeof res !== "object") return String(res ?? "");
  const content = (res as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function collectCitations(res: unknown): string[] {
  if (!res || typeof res !== "object") return [];
  const rec = res as {
    response_metadata?: Record<string, unknown>;
    additional_kwargs?: Record<string, unknown>;
  };
  const bags = [rec.response_metadata, rec.additional_kwargs];
  const out: string[] = [];
  for (const bag of bags) {
    if (!bag) continue;
    const raw = bag.citations ?? bag.sources;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string" && item.trim()) out.push(item.trim());
        else if (item && typeof item === "object" && "url" in item) {
          const url = String((item as { url?: unknown }).url ?? "");
          if (url) out.push(url);
        }
      }
    }
  }
  return [...new Set(out)];
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function invokeJson<T>(
  llm: ChatOpenAI,
  schema: z.ZodType<T>,
  system: string,
  user: string,
  hint: string,
): Promise<{ data: T; sources: string[]; raw: unknown }> {
  const sys = `${system}\n\nReply with JSON only. No markdown fences. Shape:\n${hint}`;
  const res = await llm.invoke([
    { role: "system", content: sys },
    { role: "user", content: user },
  ]);
  const text = messageText(res);
  const data = schema.parse(extractJson(text));
  return { data, sources: collectCitations(res), raw: res };
}

export async function structuredCall<T>(
  role: AgentRole,
  schema: z.ZodType<T>,
  system: string,
  user: string,
  hint: string,
  temperature = 0.4,
): Promise<{ data: T; sources: string[]; provider: Provider; model: string }> {
  const first = chatFor(role, temperature);
  const tryOnce = async (llm: ChatOpenAI) => {
    if (first.provider !== "perplexity") {
      try {
        const structured = llm.withStructuredOutput(schema);
        const data = await structured.invoke([
          { role: "system", content: `${system}\n\nMatch this shape:\n${hint}` },
          { role: "user", content: user },
        ]);
        return { data: schema.parse(data), sources: [] as string[] };
      } catch {
        // JSON fallback below
      }
    }
    return invokeJson(llm, schema, system, user, hint);
  };

  try {
    const result = await tryOnce(first.llm);
    return { ...result, provider: first.provider, model: first.model };
  } catch (err) {
    const msg = sanitizeError(err);
    if (isFixedTemperatureError(msg) && temperature !== undefined) {
      const key = readKey(first.provider);
      if (key) {
        const retry = makeChat(first.provider, first.model, key);
        const result = await tryOnce(retry);
        return { ...result, provider: first.provider, model: first.model };
      }
    }
    if (first.provider === "perplexity" && /404/.test(msg)) {
      const key = readKey("perplexity");
      if (key) {
        const retry = makeChat(
          "perplexity",
          first.model,
          key,
          temperature,
          "https://api.perplexity.ai/v1",
        );
        const result = await tryOnce(retry);
        return { ...result, provider: first.provider, model: first.model };
      }
    }
    throw new Error(msg || `${providerLabel(first.provider)} call failed`);
  }
}
