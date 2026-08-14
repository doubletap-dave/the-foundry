export type Provider = "openai" | "grok" | "openrouter" | "perplexity";
export type AgentRole = "default" | "scout" | "contrarian" | "maker" | "judge";

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "grok", label: "Grok" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "perplexity", label: "Perplexity" },
];

export const PROVIDER_IDS = ["openai", "grok", "openrouter", "perplexity"] as const;

export type KeyStatus = {
  provider: Provider;
  set: boolean;
  last4: string;
};

export type CatalogEntry = {
  provider: Provider;
  id: string;
  label: string;
  note: string;
};

/** Selectable Perplexity models. Live /models often only lists sonar. Do not include deprecated sonar-reasoning. */
export const PERPLEXITY_FALLBACK: CatalogEntry[] = [
  { provider: "perplexity", id: "sonar", label: "sonar", note: "search" },
  { provider: "perplexity", id: "sonar-pro", label: "sonar-pro", note: "recommended" },
  { provider: "perplexity", id: "sonar-reasoning-pro", label: "sonar-reasoning-pro", note: "reasoning" },
  { provider: "perplexity", id: "sonar-deep-research", label: "sonar-deep-research", note: "research" },
];

export const FALLBACK_CATALOG: CatalogEntry[] = [
  { provider: "openai", id: "gpt-4.1", label: "gpt-4.1", note: "fallback" },
  { provider: "openai", id: "gpt-4.1-mini", label: "gpt-4.1-mini", note: "fallback" },
  { provider: "openai", id: "gpt-4o", label: "gpt-4o", note: "fallback" },
  { provider: "openai", id: "gpt-4o-mini", label: "gpt-4o-mini", note: "fallback" },
  { provider: "openai", id: "o4-mini", label: "o4-mini", note: "fallback" },
  { provider: "openai", id: "o3-mini", label: "o3-mini", note: "fallback" },
  { provider: "grok", id: "grok-3", label: "grok-3", note: "fallback" },
  { provider: "grok", id: "grok-3-mini", label: "grok-3-mini", note: "fallback" },
  { provider: "grok", id: "grok-2", label: "grok-2", note: "fallback" },
  { provider: "grok", id: "grok-2-1212", label: "grok-2-1212", note: "fallback" },
  {
    provider: "openrouter",
    id: "anthropic/claude-sonnet-4",
    label: "claude-sonnet-4",
    note: "fallback",
  },
  {
    provider: "openrouter",
    id: "anthropic/claude-3.5-sonnet",
    label: "claude-3.5-sonnet",
    note: "fallback",
  },
  {
    provider: "openrouter",
    id: "openai/gpt-4.1",
    label: "openai/gpt-4.1",
    note: "fallback",
  },
  {
    provider: "openrouter",
    id: "google/gemini-2.0-flash",
    label: "gemini-2.0-flash",
    note: "fallback",
  },
  {
    provider: "openrouter",
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "llama-3.3-70b",
    note: "fallback",
  },
  ...PERPLEXITY_FALLBACK,
];

/** @deprecated Use live catalogs from the models page. Kept so old imports compile. */
export const MODEL_CATALOG = FALLBACK_CATALOG;

export const AGENT_ROLES: { id: AgentRole; label: string; blurb: string }[] = [
  { id: "default", label: "Default", blurb: "Used unless an agent has its own override." },
  { id: "scout", label: "Scout", blurb: "What exists, what data, what is blocked." },
  { id: "contrarian", label: "Contrarian", blurb: "Why the obvious version is bad." },
  { id: "maker", label: "Maker", blurb: "Turns the idea into three experiments." },
  { id: "judge", label: "Judge", blurb: "Scores and recommends one to build." },
];

export function providerLabel(provider: Provider): string {
  return PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
}

export function modelsFor(provider: Provider) {
  return FALLBACK_CATALOG.filter((m) => m.provider === provider);
}

export function defaultModelFor(provider: Provider): string {
  if (provider === "perplexity") return "sonar-pro";
  if (provider === "grok") return "grok-3-mini";
  if (provider === "openrouter") return "anthropic/claude-sonnet-4";
  return "gpt-4.1-mini";
}
