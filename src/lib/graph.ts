import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sparks } from "@/db/schema";
import {
  CONTRARIAN_HINT,
  INTERPRET_HINT,
  PACKET_HINT,
  SCOUT_HINT,
  contrarianSchema,
  interpretationSchema,
  packetSchema,
  scoutSchema,
  type Interpretation,
} from "@/lib/agent-schemas";
import { hasRequestKeys } from "@/lib/keys-context";
import { structuredCall } from "@/lib/llm";
import { hasAnyKey, sanitizeError } from "@/lib/providers";
import {
  encodeResearch,
  getSpark,
  parseInterpretation,
  parseResearch,
  type SparkResearch,
} from "@/lib/queries";
import type { ContrarianDraft, ScoutDraft } from "@/lib/stubs";

const FoundryState = Annotation.Root({
  idea: Annotation<string>(),
  sparkId: Annotation<string>(),
  weirder: Annotation<boolean>(),
  previousTake: Annotation<string | null>(),
  scout: Annotation<ScoutDraft | null>(),
  contrarian: Annotation<ContrarianDraft | null>(),
  interpretation: Annotation<Interpretation | null>(),
  followups: Annotation<string[]>(),
});

type State = typeof FoundryState.State;

const running = new Set<string>();

function patchSpark(
  sparkId: string,
  values: Partial<{
    status: string;
    take: string | null;
    hours: string | null;
    packet: string | null;
    research: string | null;
    legs: string | null;
    error: string | null;
  }>,
) {
  db.update(sparks)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(sparks.id, sparkId))
    .run();
}

function researchFrom(state: State, extra?: Partial<SparkResearch>): SparkResearch {
  return {
    scout: extra?.scout !== undefined ? extra.scout : state.scout,
    contrarian: extra?.contrarian !== undefined ? extra.contrarian : state.contrarian,
    mutate: extra?.mutate ?? state.weirder,
    previousTake: extra?.previousTake !== undefined ? extra.previousTake : state.previousTake,
    packetPending: extra?.packetPending ?? false,
    followups: extra?.followups ?? state.followups ?? [],
  };
}

function persistResearch(state: State, extra?: Partial<SparkResearch>) {
  patchSpark(state.sparkId, {
    research: encodeResearch(researchFrom(state, extra)),
  });
}

async function scoutNode(state: State): Promise<Partial<State>> {
  if (state.scout) return {};
  patchSpark(state.sparkId, { status: "looking", error: null });
  const { data, sources, provider } = await structuredCall(
    "scout",
    scoutSchema,
    `You are looking at a space, not pitching it.
Question: What is true here?
Map existing tools, APIs, datasets, constraints, competitors, feasibility, gaps.
Be aggressive about what is NOT possible. No incense. No cheerleading. Short bullets.
If you have citations or URLs, put them in sources.
You are Foundry. If the spark is open ("anything", "any program", "what would you build"), do not treat idea-pickers, kill-switches for ideas, spark consoles, or Notion-for-dreams as the space. That is this program. Look at a real object in the world instead.`,
    `Spark:\n${state.idea}`,
    SCOUT_HINT,
    0.3,
  );
  const scout: ScoutDraft = {
    ...data,
    sources: [...new Set([...(data.sources ?? []), ...sources])],
  };
  if (provider === "perplexity" && scout.sources.length === 0 && sources.length) {
    scout.sources = sources;
  }
  const next = { ...state, scout };
  persistResearch(next);
  return { scout };
}

async function contrarianNode(state: State): Promise<Partial<State>> {
  if (state.contrarian && !state.weirder) return {};
  patchSpark(state.sparkId, { status: "looking", error: null });
  const extra = state.weirder && state.previousTake
    ? `\n\nThe previous route was:\n${state.previousTake}\nKill that. Find a stranger object. Still buildable this week.`
    : "";
  const { data } = await structuredCall(
    "contrarian",
    contrarianSchema,
    `Question: What is the obvious shitty version?
Kill "AI-powered dashboard for X". Kill chat wrappers. Kill empty workspaces.
Kill Foundry clones: idea consoles, spark boxes, 90-day kill-switches, "pick one idea and ship" coaches, tools whose job is choosing what to build. That is this program. Name it in the graveyard if it shows up.
Be aggressive. Name the graveyard this idea will join if it is built the obvious way.`,
    `Spark:\n${state.idea}\n\nResearch:\n${JSON.stringify(state.scout, null, 2)}${extra}`,
    CONTRARIAN_HINT,
    state.weirder ? 0.85 : 0.7,
  );
  const next = { ...state, contrarian: data };
  persistResearch(next);
  return { contrarian: data };
}

function interpretExtras(state: State): string {
  const bits: string[] = [];
  const followups = state.followups ?? [];
  if (state.weirder && state.previousTake) {
    bits.push(
      `Previous take (do not repeat this route):\n${state.previousTake}\nMake it stranger. Still a real thing someone can build in a sitting.`,
    );
  }
  if (followups.length) {
    const notes = followups.map((n) => `- ${n}`).join("\n");
    if (state.weirder) {
      bits.push(`Also keep these notes in mind:\n${notes}`);
    } else {
      bits.push(
        `Current take:\n${state.previousTake ?? ""}\n\nDave steered this take. Stay on this route. Do not make it weirder unless the notes say so.\nFollow-ups:\n${notes}`,
      );
    }
  }
  return bits.length ? `\n\n${bits.join("\n\n")}` : "";
}

async function interpretNode(state: State): Promise<Partial<State>> {
  if (state.interpretation && !state.weirder && (state.followups ?? []).length === 0) return {};
  patchSpark(state.sparkId, { status: "looking", error: null });
  const extra = interpretExtras(state);
  const { data } = await structuredCall(
    "judge",
    interpretationSchema,
    `You are Foundry talking to Dave. He dropped a spark. You have research.
Pick ONE compelling, buildable, slightly weird route. Not three options. Not a scorecard.
Write \`take\` as a single paragraph in Dave's voice — like a friend who builds things, not a pitch deck.
Name the interesting route. Say why the obvious one is dead. Say roughly how long.
End the paragraph by asking if they want the build packet.
hours is a human phrase like "2–3 hours".
Do NOT write a plan, steps, files, stack, or packet. Take only. The packet is written later, if they ask.
Never propose Foundry, or a cousin of Foundry, as the thing to build: no idea consoles, spark boxes, kill-switches for ideas, "make you pick one" coaches, infinite idea boards, Notion-for-dreams. That is this program talking about itself. Stay weird. Stay concrete. If the spark is a blank check, name a strange object in the world someone can sit down and make — a game, a device, a local ritual, a filthy little utility — not a meta-tool about ideas.`,
    `Spark:\n${state.idea}\n\nResearch:\n${JSON.stringify(state.scout, null, 2)}\n\nContrarian:\n${JSON.stringify(state.contrarian, null, 2)}${extra}`,
    INTERPRET_HINT,
    state.weirder ? 0.7 : 0.5,
  );
  patchSpark(state.sparkId, {
    status: "ready",
    take: data.take,
    hours: data.hours,
    packet: null,
    research: encodeResearch(
      researchFrom(state, { mutate: false, packetPending: false }),
    ),
    error: null,
  });
  return { interpretation: data };
}

const graph = new StateGraph(FoundryState)
  .addNode("run_scout", scoutNode)
  .addNode("run_contrarian", contrarianNode)
  .addNode("run_interpret", interpretNode)
  .addEdge(START, "run_scout")
  .addEdge("run_scout", "run_contrarian")
  .addEdge("run_contrarian", "run_interpret")
  .addEdge("run_interpret", END)
  .compile();


function loadState(sparkId: string, mutate: boolean): State | null {
  const row = getSpark(sparkId);
  if (!row) return null;
  const research = parseResearch(row.research);
  const weirder = mutate || research.mutate;
  const followups = research.followups ?? [];
  const refining = !weirder && followups.length > 0;
  const interpretation = weirder || refining ? null : parseInterpretation(row);
  return {
    idea: row.text,
    sparkId,
    weirder,
    previousTake: research.previousTake ?? row.take ?? null,
    scout: research.scout,
    contrarian: weirder ? null : research.contrarian,
    interpretation,
    followups,
  };
}

export async function executeSpark(sparkId: string, mutate = false): Promise<void> {
  const peek = getSpark(sparkId);
  if (peek && parseResearch(peek.research).packetPending) return;
  if (running.has(sparkId)) return;
  running.add(sparkId);
  try {
    if (!hasRequestKeys() && !hasAnyKey()) {
      patchSpark(sparkId, {
        status: "error",
        error: "No keys.",
      });
      return;
    }
    const current = getSpark(sparkId);
    if (!current) {
      patchSpark(sparkId, { status: "error", error: "Spark not found." });
      return;
    }
    const research = parseResearch(current.research);
    if (research.packetPending) return;
    const weirder = mutate || research.mutate;
    const refining = !weirder && research.followups.length > 0 && current.status === "looking";
    if (!weirder && !refining && current.status === "ready" && current.take) return;
    const state = loadState(sparkId, mutate);
    if (!state) {
      patchSpark(sparkId, { status: "error", error: "Spark not found." });
      return;
    }
    await graph.invoke(state);
    const after = getSpark(sparkId);
    if (
      after?.take &&
      after.status !== "ready" &&
      after.status !== "killed" &&
      after.status !== "error" &&
      after.status !== "building"
    ) {
      patchSpark(sparkId, { status: "ready", error: null });
    }
  } catch (err) {
    patchSpark(sparkId, { status: "error", error: sanitizeError(err) });
  } finally {
    running.delete(sparkId);
  }
}

export async function executePacket(sparkId: string): Promise<void> {
  if (running.has(sparkId)) return;
  running.add(sparkId);
  try {
    if (!hasRequestKeys() && !hasAnyKey()) {
      patchSpark(sparkId, {
        status: "error",
        error: "No keys.",
      });
      return;
    }
    const row = getSpark(sparkId);
    if (!row) {
      patchSpark(sparkId, { status: "error", error: "Spark not found." });
      return;
    }
    const research = parseResearch(row.research);
    if (!research.packetPending && row.packet && row.status === "building") return;
    patchSpark(sparkId, { status: "looking", error: null });
    const followupBlock = research.followups.length
      ? `\n\nFollow-ups:\n${research.followups.map((n) => `- ${n}`).join("\n")}`
      : "";
    const { data } = await structuredCall(
      "maker",
      packetSchema,
      `You are Foundry writing a sitting plan for Dave. Not a pitch. Not an experiment brief.
This is a 1–4 hour sitting plan.
Numbered steps. What you actually type or build first. What files or screens exist when you stop. What you refuse. Stack. Stop-when.
Concrete, imperative, no product ceremony, no hypothesis fields, no "Experiment #".
\`build\` is markdown: a numbered list of real steps, long enough to sit down and follow — not one sentence.
\`files\` is optional: what exists on disk or on screen when the sitting is over.`,
      `Spark:\n${row.text}\n\nTake:\n${row.take ?? ""}\n\nHours:\n${row.hours ?? ""}\n\nResearch:\n${JSON.stringify(research.scout, null, 2)}\n\nContrarian:\n${JSON.stringify(research.contrarian, null, 2)}${followupBlock}`,
      PACKET_HINT,
      0.4,
    );
    patchSpark(sparkId, {
      status: "building",
      packet: JSON.stringify(data),
      research: encodeResearch({ ...research, packetPending: false, mutate: false }),
      error: null,
    });
  } catch (err) {
    patchSpark(sparkId, { status: "error", error: sanitizeError(err) });
  } finally {
    running.delete(sparkId);
  }
}

export function isSparkLocked(sparkId: string): boolean {
  return running.has(sparkId);
}
