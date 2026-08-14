import { db } from "../src/db";
import { sparks } from "../src/db/schema";
import { id } from "../src/lib/ids";
import { executeSpark } from "../src/lib/graph";

const ideaText = process.argv[2] ?? "I want to make something weird";

async function main() {
  const now = new Date();
  const sparkId = id("spark");
  db.insert(sparks)
    .values({
      id: sparkId,
      owner: null,
      text: ideaText,
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
  console.log(JSON.stringify({ sparkId, ideaText }));
  await executeSpark(sparkId);
  const row = db.select().from(sparks).where((await import("drizzle-orm")).eq(sparks.id, sparkId)).get();
  console.log(JSON.stringify({ done: true, status: row?.status, take: row?.take, error: row?.error }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
