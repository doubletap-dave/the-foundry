import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  contrarianReports,
  experiments,
  ideas,
  judgeScores,
  modelConfigs,
  runs,
  scoutReports,
} from "./schema";
import { id } from "../lib/ids";
import { stubForIdea } from "../lib/stubs";

function ensureModels() {
  const now = new Date();
  const defaults: { role: string; provider: string; model: string }[] = [
    { role: "default", provider: "openai", model: "gpt-4.1-mini" },
    { role: "scout", provider: "openai", model: "gpt-4.1-mini" },
    { role: "contrarian", provider: "openai", model: "gpt-4.1-mini" },
    { role: "maker", provider: "openai", model: "gpt-4.1" },
    { role: "judge", provider: "openai", model: "gpt-4.1-mini" },
  ];
  for (const row of defaults) {
    const existing = db.select().from(modelConfigs).where(eq(modelConfigs.role, row.role)).get();
    if (!existing) {
      db.insert(modelConfigs)
        .values({
          id: id("model"),
          role: row.role,
          provider: row.provider,
          model: row.model,
          updatedAt: now,
        })
        .run();
    }
  }
}

function seedTarkovRun() {
  const existing = db.select().from(ideas).all();
  const already = existing.some((row) => /tarkov/i.test(row.text));
  if (already) {
    console.log("Tarkov seed already present.");
    return;
  }

  const text = "I want to do something with Escape from Tarkov";
  const stub = stubForIdea(text);
  const now = new Date();
  const ideaId = id("idea");
  const runId = id("run");

  db.insert(ideas).values({ id: ideaId, text, createdAt: now }).run();
  db.insert(runs).values({ id: runId, ideaId, status: "complete", phase: "judge", createdAt: now }).run();

  db.insert(scoutReports)
    .values({
      id: id("scout"),
      runId,
      existing: JSON.stringify(stub.scout.existing),
      dataAvailable: JSON.stringify(stub.scout.dataAvailable),
      notPossible: JSON.stringify(stub.scout.notPossible),
      constraints: JSON.stringify(stub.scout.constraints),
      openings: JSON.stringify(stub.scout.openings),
      sources: JSON.stringify(stub.scout.sources),
    })
    .run();

  db.insert(contrarianReports)
    .values({
      id: id("con"),
      runId,
      obviousVersions: JSON.stringify(stub.contrarian.obviousVersions),
      whyBad: JSON.stringify(stub.contrarian.whyBad),
      contradictions: JSON.stringify(stub.contrarian.contradictions),
      angles: JSON.stringify(stub.contrarian.angles),
      constraintsToExploit: JSON.stringify(stub.contrarian.constraintsToExploit),
    })
    .run();

  stub.experiments.forEach((exp, index) => {
    const experimentId = id("exp");
    db.insert(experiments)
      .values({
        id: experimentId,
        ideaId,
        runId,
        name: exp.name,
        hypothesis: exp.hypothesis,
        artifact: exp.artifact,
        buildScope: exp.buildScope,
        dontBuild: exp.dontBuild,
        maxHours: exp.maxHours,
        maxCost: exp.maxCost,
        passCriteria: exp.passCriteria,
        failCriteria: exp.failCriteria,
        learnIfFail: exp.learnIfFail,
        stack: exp.stack,
        status: "proposed",
      })
      .run();

    const score = stub.scores[index];
    if (score) {
      db.insert(judgeScores)
        .values({
          id: id("judge"),
          runId,
          experimentId,
          ...score,
        })
        .run();
    }
  });

  console.log(`Seeded Tarkov run ${runId}`);
}

ensureModels();
seedTarkovRun();
console.log("Seed complete.");
