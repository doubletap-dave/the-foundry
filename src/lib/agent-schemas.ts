import { z } from "zod";
import type { ContrarianDraft, ScoutDraft } from "@/lib/stubs";

export type Packet = {
  build: string;
  dont: string;
  stack: string;
  stopWhen: string;
  files?: string;
};

export type Interpretation = {
  take: string;
  hours: string;
};

export const scoutSchema: z.ZodType<ScoutDraft> = z.object({
  existing: z.array(z.string()).min(1),
  dataAvailable: z.array(z.string()).min(1),
  notPossible: z.array(z.string()).min(1),
  constraints: z.array(z.string()).min(1),
  openings: z.array(z.string()).min(1),
  sources: z.array(z.string()),
});

export const contrarianSchema: z.ZodType<ContrarianDraft> = z.object({
  obviousVersions: z.array(z.string()).min(1),
  whyBad: z.array(z.string()).min(1),
  contradictions: z.array(z.string()).min(1),
  angles: z.array(z.string()).min(1),
  constraintsToExploit: z.array(z.string()).min(1),
});

export const packetReadSchema: z.ZodType<Packet> = z.object({
  build: z.string().min(1),
  dont: z.string().min(1),
  stack: z.string().min(1),
  stopWhen: z.string().min(1),
  files: z.string().optional(),
});

export const packetSchema: z.ZodType<Packet> = z.object({
  build: z.string().min(80),
  dont: z.string().min(1),
  stack: z.string().min(1),
  stopWhen: z.string().min(1),
  files: z.string().optional(),
});

export const interpretationSchema: z.ZodType<Interpretation> = z.object({
  take: z.string().min(20),
  hours: z.string().min(1),
});

export const SCOUT_HINT = `{
  "existing": ["string"],
  "dataAvailable": ["string"],
  "notPossible": ["string"],
  "constraints": ["string"],
  "openings": ["string"],
  "sources": ["url or source"]
}`;

export const CONTRARIAN_HINT = `{
  "obviousVersions": ["string"],
  "whyBad": ["string"],
  "contradictions": ["string"],
  "angles": ["string"],
  "constraintsToExploit": ["string"]
}`;

export const INTERPRET_HINT = `{
  "take": "One paragraph in Dave's voice. Name the interesting route, why the obvious one is dead, roughly how long. End with: Want the build packet?",
  "hours": "2–3 hours"
}
take is ONE paragraph. Not a list. Not three options. Not a plan. Do not write packet or steps.`;

export const PACKET_HINT = `{
  "build": "1. Open the repo and …\\n2. Next concrete move the agent types or creates.\\n3. Keep going until the sitting is done.",
  "dont": "Hard refusals. What the agent must not do this sitting.",
  "stack": "Next.js / TypeScript / local SQLite",
  "stopWhen": "the moment the agent should stop, even if more is possible",
  "files": "Concrete paths or screens that exist when the sitting is over."
}
The reader is an AI coding agent. build is numbered imperative steps it can execute. dont is hard refusals. No pitch. No hypothesis. No Experiment #.`;

export type SparkThoughtAgent = "scout" | "contrarian" | "maker";
export type SparkPhase = "scout" | "contrarian" | "interpret" | "packet";

export type SparkThought = {
  agent: SparkThoughtAgent;
  lines: string[];
};

export type SparkView = {
  id: string;
  text: string;
  status: string;
  take: string | null;
  hours: string | null;
  packet: Packet | null;
  legs: string | null;
  error: string | null;
  createdAt?: string;
  thoughts?: SparkThought[];
  phase?: SparkPhase;
};
