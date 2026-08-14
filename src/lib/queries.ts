import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { modelConfigs, sparks } from "@/db/schema";
import { packetReadSchema, type Interpretation, type Packet, type SparkView } from "@/lib/agent-schemas";
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

export function toSparkView(row: SparkRow): SparkView {
  const created =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
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
