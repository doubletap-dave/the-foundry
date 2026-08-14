import { randomBytes } from "crypto";
import { eq, isNull, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sparks } from "@/db/schema";

export const OWNER_COOKIE = "foundry_who";
const MAX_AGE = 60 * 60 * 24 * 365;

function validOwner(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{32,}$/i.test(value);
}

function backfillLegacyOwners(owner: string): void {
  const orphan = db
    .select({ id: sparks.id })
    .from(sparks)
    .where(or(isNull(sparks.owner), eq(sparks.owner, "")))
    .get();
  if (!orphan) return;
  db.update(sparks)
    .set({ owner })
    .where(or(isNull(sparks.owner), eq(sparks.owner, "")))
    .run();
}

/** Nameless browser id. Sets the cookie on first action and claims owner=null sparks once. */
export async function who(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value?.trim();
  if (validOwner(existing)) return existing;

  const token = randomBytes(16).toString("hex");
  jar.set(OWNER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  backfillLegacyOwners(token);
  return token;
}
