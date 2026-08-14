"use server";

import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { modelConfigs, sparks } from "@/db/schema";
import { executePacket, executeSpark } from "@/lib/graph";
import { id } from "@/lib/ids";
import { bagHasKey, sanitizeKeys, type RequestKeys } from "@/lib/keys";
import { runWithKeys, type ModelChoice } from "@/lib/keys-context";
import type { AgentRole, Provider } from "@/lib/models";
import { PROVIDER_IDS } from "@/lib/models";
import { who } from "@/lib/owner";
import {
  fetchAllCatalogs,
  fetchCatalog,
  hasAnyKey,
  listKeyStatuses,
  sanitizeError,
  testProviderConnection,
} from "@/lib/providers";
import { claimSpark, encodeResearch, getSpark, listBuiltSparks, parseResearch, toSparkView, type SparkSnapshot, type SparkView } from "@/lib/queries";

const ideaSchema = z.string().trim().min(8, "Give it a real sentence.").max(2000);

const keysSchema = z
  .object({
    openai: z.string().optional(),
    grok: z.string().optional(),
    openrouter: z.string().optional(),
    perplexity: z.string().optional(),
  })
  .optional();

function parseKeys(raw: RequestKeys | undefined): RequestKeys {
  const parsed = keysSchema.safeParse(raw);
  return sanitizeKeys(parsed.success ? parsed.data : {});
}

const choiceSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  model: z.string().trim().min(1),
});

function parseChoice(raw: ModelChoice | null | undefined): ModelChoice | undefined {
  const parsed = choiceSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

const snapshotSchema = z.object({
  text: z.string().trim().min(1),
  take: z.string().nullable().optional(),
  hours: z.string().nullable().optional(),
});

function parseSnapshot(raw: SparkSnapshot | undefined): SparkSnapshot | undefined {
  const parsed = snapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function canIgnite(keys: RequestKeys): boolean {
  return bagHasKey(keys) || hasAnyKey();
}

export async function submitSpark(
  raw: string,
  keys?: RequestKeys,
  choice?: ModelChoice | null,
): Promise<{ sparkId: string } | { error: string }> {
  const owner = await who();
  const bag = parseKeys(keys);
  const parsedChoice = parseChoice(choice);
  const parsed = ideaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid spark" };
  }
  if (!canIgnite(bag)) {
    return { error: "No keys." };
  }

  const now = new Date();
  const sparkId = id("spark");
  db.insert(sparks)
    .values({
      id: sparkId,
      owner,
      text: parsed.data,
      status: "looking",
      take: null,
      hours: null,
      packet: null,
      research: null,
      legs: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  after(async () => {
    await runWithKeys(bag, () => executeSpark(sparkId), parsedChoice);
  });

  return { sparkId };
}

export async function readSpark(sparkId: string): Promise<SparkView | null> {
  const owner = await who();
  const row = getSpark(sparkId, owner);
  return row ? toSparkView(row) : null;
}

export async function advanceSpark(
  sparkId: string,
  keys?: RequestKeys,
  choice?: ModelChoice | null,
): Promise<{ ok: true } | { error: string }> {
  const owner = await who();
  const bag = parseKeys(keys);
  const parsedChoice = parseChoice(choice);
  const row = getSpark(sparkId, owner);
  if (!row) return { error: "Spark not found" };
  if (row.status !== "looking" && row.status !== "error") return { ok: true };
  try {
    const research = parseResearch(row.research);
    await runWithKeys(
      bag,
      () => (research.packetPending ? executePacket(sparkId) : executeSpark(sparkId, false)),
      parsedChoice,
    );
    return { ok: true };
  } catch (err) {
    return { error: sanitizeError(err) };
  }
}

export async function mutateSpark(
  sparkId: string,
  keys?: RequestKeys,
  choice?: ModelChoice | null,
  snapshot?: SparkSnapshot,
): Promise<{ ok: true } | { error: string }> {
  const owner = await who();
  const bag = parseKeys(keys);
  const parsedChoice = parseChoice(choice);
  const row = claimSpark(sparkId, owner, parseSnapshot(snapshot));
  if (!row) return { error: "Spark not found" };
  if (!canIgnite(bag)) return { error: "No keys." };

  const research = parseResearch(row.research);
  db.update(sparks)
    .set({
      status: "looking",
      error: null,
      packet: null,
      research: encodeResearch({
        scout: research.scout,
        contrarian: research.contrarian,
        mutate: true,
        previousTake: row.take,
        packetPending: false,
        followups: research.followups,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(sparks.id, sparkId), eq(sparks.owner, owner)))
    .run();

  after(async () => {
    await runWithKeys(bag, () => executeSpark(sparkId, true), parsedChoice);
  });

  return { ok: true };
}

export async function killSpark(
  sparkId: string,
): Promise<{ ok: true } | { error: string }> {
  const owner = await who();
  const row = getSpark(sparkId, owner);
  if (!row) return { error: "Spark not found" };
  db.update(sparks)
    .set({ status: "killed", updatedAt: new Date() })
    .where(and(eq(sparks.id, sparkId), eq(sparks.owner, owner)))
    .run();
  return { ok: true };
}

export async function writePacket(
  sparkId: string,
  keys?: RequestKeys,
  choice?: ModelChoice | null,
  snapshot?: SparkSnapshot,
): Promise<{ ok: true } | { error: string }> {
  const owner = await who();
  const bag = parseKeys(keys);
  const parsedChoice = parseChoice(choice);
  const row = claimSpark(sparkId, owner, parseSnapshot(snapshot));
  if (!row) return { error: "Spark not found" };
  if (!canIgnite(bag)) return { error: "No keys." };
  if (!row.take) return { error: "No take yet." };

  const research = parseResearch(row.research);
  db.update(sparks)
    .set({
      status: "looking",
      error: null,
      packet: null,
      research: encodeResearch({
        scout: research.scout,
        contrarian: research.contrarian,
        mutate: false,
        previousTake: research.previousTake,
        packetPending: true,
        followups: research.followups,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(sparks.id, sparkId), eq(sparks.owner, owner)))
    .run();

  after(async () => {
    await runWithKeys(bag, () => executePacket(sparkId), parsedChoice);
  });

  return { ok: true };
}

export async function refineSpark(
  sparkId: string,
  note: string,
  keys?: RequestKeys,
  choice?: ModelChoice | null,
  snapshot?: SparkSnapshot,
): Promise<{ ok: true } | { error: string }> {
  const owner = await who();
  const bag = parseKeys(keys);
  const parsedChoice = parseChoice(choice);
  const row = claimSpark(sparkId, owner, parseSnapshot(snapshot));
  if (!row) return { error: "Spark not found" };
  if (!canIgnite(bag)) return { error: "No keys." };
  const trimmed = note.trim();
  if (!trimmed) return { error: "Say more." };

  const research = parseResearch(row.research);
  db.update(sparks)
    .set({
      status: "looking",
      error: null,
      packet: null,
      research: encodeResearch({
        scout: research.scout,
        contrarian: research.contrarian,
        mutate: false,
        previousTake: row.take,
        packetPending: false,
        followups: [...research.followups, trimmed],
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(sparks.id, sparkId), eq(sparks.owner, owner)))
    .run();

  after(async () => {
    await runWithKeys(bag, () => executeSpark(sparkId, false), parsedChoice);
  });

  return { ok: true };
}

export async function markSparkBuilt(
  sparkId: string,
): Promise<{ ok: true } | { error: string }> {
  const owner = await who();
  const row = getSpark(sparkId, owner);
  if (!row) return { error: "Spark not found" };
  db.update(sparks)
    .set({ status: "built", updatedAt: new Date() })
    .where(and(eq(sparks.id, sparkId), eq(sparks.owner, owner)))
    .run();
  return { ok: true };
}

const legsSchema = z.enum(["yep", "kinda", "nope"]);

export async function rateLegs(
  sparkId: string,
  legs: string,
): Promise<{ ok: true } | { error: string }> {
  const parsed = legsSchema.safeParse(legs);
  if (!parsed.success) return { error: "Invalid rating" };
  const owner = await who();
  const row = getSpark(sparkId, owner);
  if (!row) return { error: "Spark not found" };
  db.update(sparks)
    .set({ status: "rated", legs: parsed.data, updatedAt: new Date() })
    .where(and(eq(sparks.id, sparkId), eq(sparks.owner, owner)))
    .run();
  return { ok: true };
}

const modelSaveSchema = z.object({
  configs: z.array(
    z.object({
      role: z.enum(["default", "scout", "contrarian", "maker", "judge"]),
      provider: z.enum(["openai", "grok", "openrouter", "perplexity"]),
      model: z.string().min(1),
    }),
  ),
});

export async function saveModelConfigs(
  input: z.infer<typeof modelSaveSchema>,
): Promise<{ ok: true } | { error: string }> {
  const parsed = modelSaveSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid model config" };

  const now = new Date();
  const rolesFor = (role: AgentRole): AgentRole[] =>
    role === "default" ? ["default", "scout", "contrarian", "maker", "judge"] : [role];
  for (const row of parsed.data.configs) {
    for (const role of rolesFor(row.role as AgentRole)) {
      const existing = db
        .select()
        .from(modelConfigs)
        .where(eq(modelConfigs.role, role))
        .get();
      if (existing) {
        db.update(modelConfigs)
          .set({
            provider: row.provider,
            model: row.model,
            updatedAt: now,
          })
          .where(eq(modelConfigs.id, existing.id))
          .run();
      } else {
        db.insert(modelConfigs)
          .values({
            id: id("model"),
            role,
            provider: row.provider as Provider,
            model: row.model,
            updatedAt: now,
          })
          .run();
      }
    }
  }
  revalidatePath("/settings");
  return { ok: true };
}

const providerSchema = z.enum(PROVIDER_IDS);

export async function testProviderKey(provider: string, key?: string) {
  const parsed = providerSchema.safeParse(provider);
  if (!parsed.success) return { error: "Unknown provider" };
  const bag: RequestKeys = {};
  if (typeof key === "string" && key.trim()) {
    bag[parsed.data] = key.trim();
  }
  return runWithKeys(bag, () => testProviderConnection(parsed.data));
}

export async function loadCatalogs(force = false) {
  try {
    const catalogs = await fetchAllCatalogs(force);
    return { catalogs };
  } catch (err) {
    return { error: sanitizeError(err), catalogs: await fetchAllCatalogs(false) };
  }
}

export async function loadOneCatalog(provider: string, key?: string) {
  const parsed = providerSchema.safeParse(provider);
  if (!parsed.success) return { error: "Unknown provider" as const };
  const bag: RequestKeys = {};
  if (typeof key === "string" && key.trim()) {
    bag[parsed.data] = key.trim();
  }
  try {
    const models = await runWithKeys(bag, () => fetchCatalog(parsed.data, true));
    return { models };
  } catch (err) {
    return { error: sanitizeError(err) };
  }
}

export async function keyStatuses() {
  return listKeyStatuses();
}

export async function listBuilt(): Promise<SparkView[]> {
  const owner = await who();
  return listBuiltSparks(owner);
}
