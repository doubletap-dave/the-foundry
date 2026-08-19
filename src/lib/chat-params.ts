function leafModelId(model: string): string {
  const raw = model.trim().toLowerCase();
  const slash = raw.lastIndexOf("/");
  return slash >= 0 ? raw.slice(slash + 1) : raw;
}

/** GPT-5 reasoning and o-series models only accept the default temperature (1). Chat variants still allow sampling. */
export function supportsCustomTemperature(model: string): boolean {
  const id = leafModelId(model);
  if (id.includes("chat")) return true;
  if (id.startsWith("gpt-5")) return false;
  if (/^o[1-9]($|-)/.test(id)) return false;
  return true;
}

export function chatSampling(
  model: string,
  temperature: number,
): { temperature?: number } {
  if (!supportsCustomTemperature(model)) return {};
  return { temperature };
}

export function isFixedTemperatureError(message: string): boolean {
  const m = message.toLowerCase();
  if (!m.includes("temperature")) return false;
  return (
    m.includes("unsupported") ||
    m.includes("does not support") ||
    m.includes("not supported")
  );
}
