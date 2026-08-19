import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatSampling,
  isFixedTemperatureError,
} from "./chat-params.ts";

test("omits temperature for GPT-5.6 Terra", () => {
  assert.deepEqual(chatSampling("gpt-5.6-terra", 0.3), {});
});

test("omits temperature for other GPT-5.6 and o-series reasoning models", () => {
  assert.deepEqual(chatSampling("gpt-5.6-sol", 0.4), {});
  assert.deepEqual(chatSampling("gpt-5.6-luna", 0.4), {});
  assert.deepEqual(chatSampling("gpt-5", 0.5), {});
  assert.deepEqual(chatSampling("o3-mini", 0.3), {});
  assert.deepEqual(chatSampling("openai/gpt-5.6-terra", 0.3), {});
});

test("keeps temperature for models that still support sampling", () => {
  assert.deepEqual(chatSampling("gpt-4.1-mini", 0.3), { temperature: 0.3 });
  assert.deepEqual(chatSampling("gpt-4o", 0.7), { temperature: 0.7 });
  assert.deepEqual(chatSampling("gpt-5-chat-latest", 0.3), { temperature: 0.3 });
  assert.deepEqual(chatSampling("grok-3-mini", 0.4), { temperature: 0.4 });
});

test("detects OpenAI fixed-temperature API errors so unknown models can retry", () => {
  assert.equal(
    isFixedTemperatureError(
      "400 Unsupported value: 'temperature' does not support 0.3 with this model. Only the default (1) value is supported.",
    ),
    true,
  );
  assert.equal(isFixedTemperatureError("rate limit exceeded"), false);
});
