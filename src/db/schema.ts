import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ideas = sqliteTable("ideas", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id")
    .notNull()
    .references(() => ideas.id),
  status: text("status").notNull(),
  phase: text("phase"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const experiments = sqliteTable("experiments", {
  id: text("id").primaryKey(),
  ideaId: text("idea_id")
    .notNull()
    .references(() => ideas.id),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  name: text("name").notNull(),
  hypothesis: text("hypothesis").notNull(),
  artifact: text("artifact").notNull(),
  buildScope: text("build_scope").notNull(),
  dontBuild: text("dont_build").notNull(),
  maxHours: integer("max_hours").notNull(),
  maxCost: real("max_cost").notNull(),
  passCriteria: text("pass_criteria").notNull(),
  failCriteria: text("fail_criteria").notNull(),
  learnIfFail: text("learn_if_fail").notNull(),
  stack: text("stack").notNull(),
  status: text("status").notNull(),
});

export const evidence = sqliteTable("evidence", {
  id: text("id").primaryKey(),
  experimentId: text("experiment_id")
    .notNull()
    .references(() => experiments.id),
  exposures: integer("exposures").notNull().default(0),
  users: integer("users").notNull().default(0),
  completions: integer("completions").notNull().default(0),
  returns: integer("returns").notNull().default(0),
  payments: integer("payments").notNull().default(0),
  revenue: real("revenue").notNull().default(0),
  humanMinutes: integer("human_minutes").notNull().default(0),
  modelCost: real("model_cost").notNull().default(0),
  notes: text("notes"),
});

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  experimentId: text("experiment_id")
    .notNull()
    .references(() => experiments.id),
  outcome: text("outcome").notNull(),
  reasoning: text("reasoning").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const modelConfigs = sqliteTable("model_configs", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const providerKeys = sqliteTable("provider_keys", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  key: text("key").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const scoutReports = sqliteTable("scout_reports", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  existing: text("existing").notNull(),
  dataAvailable: text("data_available").notNull(),
  notPossible: text("not_possible").notNull(),
  constraints: text("constraints").notNull(),
  openings: text("openings").notNull(),
  sources: text("sources").notNull(),
});

export const contrarianReports = sqliteTable("contrarian_reports", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  obviousVersions: text("obvious_versions").notNull(),
  whyBad: text("why_bad").notNull(),
  contradictions: text("contradictions").notNull(),
  angles: text("angles").notNull(),
  constraintsToExploit: text("constraints_to_exploit").notNull(),
});

export const judgeScores = sqliteTable("judge_scores", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  experimentId: text("experiment_id")
    .notNull()
    .references(() => experiments.id),
  curiosity: integer("curiosity").notNull(),
  novelty: integer("novelty").notNull(),
  tangibility: integer("tangibility").notNull(),
  buildability: integer("buildability").notNull(),
  usefulness: integer("usefulness").notNull(),
  rabbitHole: integer("rabbit_hole").notNull(),
  fuckYes: integer("fuck_yes").notNull(),
  recommended: integer("recommended", { mode: "boolean" }).notNull(),
  notes: text("notes").notNull(),
});

export const sparks = sqliteTable("sparks", {
  id: text("id").primaryKey(),
  owner: text("owner"),
  text: text("text").notNull(),
  status: text("status").notNull(),
  take: text("take"),
  hours: text("hours"),
  packet: text("packet"),
  research: text("research"),
  legs: text("legs"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
