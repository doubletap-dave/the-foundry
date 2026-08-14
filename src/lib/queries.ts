import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { modelConfigs, sparks } from "@/db/schema";
import { packetReadSchema, type Interpretation, type Packet, type SparkPhase, type SparkThought, type SparkView } from "@/lib/agent-schemas";
import type { AgentRole, Provider } from "@/lib/models";
import type { ContrarianDraft, ScoutDraft } from "@/lib/stubs";

export type SparkRow = typeof sparks.$inferSelect;
export type { SparkView };

export type SparkResearch = {
  scout: ScoutDraft | null;
  contrarian: ContrarianDraft | null;
  mutate: boolean;
  previousTake: string | null;
  packetPending: boolean;
  followups: string[];
};

export function listModelConfigs() {
  return db.select().from(modelConfigs).all() as {
    id: string;
    role: AgentRole;
    provider: Provider;
    model: string;
    updatedAt: Date;
  }[];
}

export function parsePacket(raw: string | null | undefined): Packet | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = packetReadSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function parseInterpretation(row: SparkRow): Interpretation | null {
  if (!row.take || !row.hours) return null;
  return { take: row.take, hours: row.hours };
}

export function parseResearch(raw: string | null | undefined): SparkResearch {
  if (!raw) {
    return {
      scout: null,
      contrarian: null,
      mutate: false,
      previousTake: null,
      packetPending: false,
      followups: [],
    };
  }
  try {
    const parsed = JSON.parse(raw) as {
      scout?: ScoutDraft | null;
      contrarian?: ContrarianDraft | null;
      mutate?: boolean;
      previousTake?: string | null;
      packetPending?: boolean;
      followups?: unknown;
    };
    return {
      scout: parsed.scout ?? null,
      contrarian: parsed.contrarian ?? null,
      mutate: !!parsed.mutate,
      previousTake: parsed.previousTake ?? null,
      packetPending: !!parsed.packetPending,
      followups: Array.isArray(parsed.followups)
        ? parsed.followups.filter((x): x is string => typeof x === "string")
        : [],
    };
  } catch {
    return {
      scout: null,
      contrarian: null,
      mutate: false,
      previousTake: null,
      packetPending: false,
      followups: [],
    };
  }
}

export function encodeResearch(r: SparkResearch): string {
  return JSON.stringify({
    scout: r.scout ?? null,
    contrarian: r.contrarian ?? null,
    mutate: !!r.mutate,
    previousTake: r.previousTake ?? null,
    packetPending: !!r.packetPending,
    followups: r.followups ?? [],
  });
}

export function getSpark(sparkId: string, owner?: string): SparkRow | null {
  const row = db.select().from(sparks).where(eq(sparks.id, sparkId)).get() ?? null;
  if (!row) return null;
  if (owner !== undefined && row.owner !== owner) return null;
  return row;
}

export type SparkSnapshot = {
  text: string;
  take?: string | null;
  hours?: string | null;
};

/** Reclaim a spark this browser owns, or recreate it from the client snapshot (Vercel /tmp). */
export function claimSpark(
  sparkId: string,
  owner: string,
  snapshot?: SparkSnapshot,
): SparkRow | null {
  const row = db.select().from(sparks).where(eq(sparks.id, sparkId)).get() ?? null;
  if (row) {
    if (row.owner && row.owner !== owner) return null;
    if (!row.owner) {
      db.update(sparks)
        .set({ owner, updatedAt: new Date() })
        .where(eq(sparks.id, sparkId))
        .run();
      return { ...row, owner };
    }
    return row;
  }
  const text = snapshot?.text?.trim();
  if (!text) return null;
  const now = new Date();
  db.insert(sparks)
    .values({
      id: sparkId,
      owner,
      text,
      status: snapshot?.take ? "ready" : "looking",
      take: snapshot?.take ?? null,
      hours: snapshot?.hours ?? null,
      packet: null,
      research: null,
      legs: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getSpark(sparkId, owner);
}

function shortThought(raw: string, max = 92): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function pickThoughtLines(pools: Array<string[] | undefined>, n = 3): string[] {
  const out: string[] = [];
  for (const pool of pools) {
    if (!pool) continue;
    for (const item of pool) {
      const line = shortThought(item);
      if (!line || out.includes(line)) continue;
      out.push(line);
      if (out.length >= n) return out;
      break;
    }
  }
  return out;
}

function researchPhase(row: SparkRow, research: SparkResearch): SparkPhase {
  const writingPacket =
    research.packetPending || (row.status === "looking" && research.packetPending);
  if (writingPacket) return "packet";
  if (!research.scout) return "scout";
  if (!research.contrarian) return "contrarian";
  return "interpret";
}

function researchThoughts(research: SparkResearch): SparkThought[] {
  const thoughts: SparkThought[] = [];
  if (research.scout) {
    thoughts.push({
      agent: "scout",
      lines: pickThoughtLines([
        research.scout.openings,
        research.scout.constraints,
        research.scout.existing,
        research.scout.notPossible,
      ]),
    });
  }
  if (research.contrarian) {
    thoughts.push({
      agent: "contrarian",
      lines: pickThoughtLines([
        research.contrarian.whyBad,
        research.contrarian.angles,
        research.contrarian.constraintsToExploit,
        research.contrarian.obviousVersions,
      ]),
    });
  }
  return thoughts;
}

export function toSparkView(row: SparkRow): SparkView {
  const created =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
  const research = parseResearch(row.research);
  return {
    id: row.id,
    text: row.text,
    status: row.status,
    take: row.take,
    hours: row.hours,
    packet: parsePacket(row.packet),
    legs: row.legs,
    error: row.error,
    createdAt: created,
    phase: researchPhase(row, research),
    thoughts: researchThoughts(research),
  };
}

export function listBuiltSparks(owner: string): SparkView[] {
  const rows = db
    .select()
    .from(sparks)
    .where(and(inArray(sparks.status, ["building", "built", "rated"]), eq(sparks.owner, owner)))
    .orderBy(desc(sparks.updatedAt))
    .all();
  return rows.map(toSparkView);
}
