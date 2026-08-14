import type { SparkView } from "@/lib/agent-schemas";

const CURRENT = "foundry.currentSpark";
const SPARKS = "foundry.sparks";
const LEGACY = "foundry.sparkId";
const MAX = 50;
const BUILT = new Set(["building", "built", "rated"]);

function canStore(): boolean {
  return typeof window !== "undefined";
}

function readAll(): SparkView[] {
  if (!canStore()) return [];
  try {
    const raw = localStorage.getItem(SPARKS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is SparkView => !!row && typeof row === "object" && typeof (row as SparkView).id === "string");
  } catch {
    return [];
  }
}

function writeAll(rows: SparkView[]): void {
  if (!canStore()) return;
  const sorted = [...rows].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const trimmed = sorted.slice(0, MAX);
  try {
    localStorage.setItem(SPARKS, JSON.stringify(trimmed));
  } catch {
    /* quota */
  }
}

export function readCurrentSparkId(): string | null {
  if (!canStore()) return null;
  try {
    const id = localStorage.getItem(CURRENT);
    if (id) return id;
    const legacy = sessionStorage.getItem(LEGACY);
    if (legacy) {
      localStorage.setItem(CURRENT, legacy);
      sessionStorage.removeItem(LEGACY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCurrentSparkId(id: string | null): void {
  if (!canStore()) return;
  try {
    if (!id) localStorage.removeItem(CURRENT);
    else localStorage.setItem(CURRENT, id);
    sessionStorage.removeItem(LEGACY);
  } catch {
    /* ignore */
  }
}

export function rememberSpark(spark: SparkView): void {
  if (!canStore() || !spark?.id) return;
  const rows = readAll().filter((row) => row.id !== spark.id);
  rows.unshift(spark);
  writeAll(rows);
}

export function recallSpark(id: string): SparkView | null {
  return readAll().find((row) => row.id === id) ?? null;
}

export function listRemembered(): SparkView[] {
  return readAll();
}

export function listRememberedBuilt(): SparkView[] {
  return readAll().filter((row) => BUILT.has(row.status));
}

export function mergeBuilt(server: SparkView[]): SparkView[] {
  const map = new Map<string, SparkView>();
  for (const row of listRememberedBuilt()) map.set(row.id, row);
  for (const row of server) map.set(row.id, row);
  return [...map.values()].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}
