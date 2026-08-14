"use client";

import { useEffect, useRef, type ReactNode } from "react";
import anime from "@/vendor/anime.js";
import type { SparkPhase, SparkThought } from "@/lib/agent-schemas";

export type { SparkPhase, SparkThought };

type SeatId = "scout" | "contrarian" | "planner";
type SeatState = "waiting" | "live" | "done";

const LOOKING_AT: Record<SeatId, string[]> = {
  scout: [
    "What already exists in this space",
    "Where the data actually lives",
    "What's fake or impossible",
    "The constraint that would kill a clone",
  ],
  contrarian: [
    "The obvious product",
    "Why that version gets hated",
    "A constraint worth exploiting",
  ],
  planner: [
    "The smallest version worth touching",
    "What not to build this sitting",
  ],
};

const HANDOFF: Partial<Record<SeatId, { to: string; note: string }>> = {
  scout: {
    to: "Contrarian",
    note: "Kill the obvious version. Find the constraint it's hiding.",
  },
  contrarian: {
    to: "Planner",
    note: "Write the smallest honest sitting of the weird route.",
  },
};

const NAMES: Record<SeatId, string> = {
  scout: "Scout",
  contrarian: "Contrarian",
  planner: "Planner",
};

function seatState(id: SeatId, phase: SparkPhase): SeatState {
  if (phase === "scout") {
    if (id === "scout") return "live";
    return "waiting";
  }
  if (phase === "contrarian") {
    if (id === "scout") return "done";
    if (id === "contrarian") return "live";
    return "waiting";
  }
  if (id === "planner") return "live";
  return "done";
}

function foundFor(id: SeatId, thoughts: SparkThought[]): string[] {
  const agent = id === "planner" ? "maker" : id;
  return thoughts.find((t) => t.agent === agent)?.lines ?? [];
}

export function FadeIn({
  children,
  className,
  duration = 500,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
}) {
  const el = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    anime.remove(node);
    anime({
      targets: node,
      opacity: [0, 1],
      duration,
      easing: "easeOutCubic",
    });
    return () => {
      anime.remove(node);
    };
  }, [duration]);

  return (
    <p ref={el} className={className} style={{ opacity: 0 }}>
      {children}
    </p>
  );
}

function Sparkle() {
  return (
    <div className="foundry-sparkle shrink-0" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="rounded-none" />
      ))}
    </div>
  );
}

function Seat({
  id,
  state,
  found,
}: {
  id: SeatId;
  state: SeatState;
  found: string[];
}) {
  const el = useRef<HTMLDivElement>(null);
  const prev = useRef(state);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    anime.remove(node);
    anime({
      targets: node,
      opacity: [prev.current === state ? 0 : 0.55, 1],
      translateY: [10, 0],
      duration: 480,
      easing: "easeOutCubic",
    });
    prev.current = state;
    return () => {
      anime.remove(node);
    };
  }, [state, found.join("|")]);

  const handoff = state === "done" ? HANDOFF[id] : null;
  const looking = state === "live" ? LOOKING_AT[id] : [];

  return (
    <div ref={el} className="relative pl-4" style={{ opacity: 0 }}>
      <span className="absolute left-0 top-2 h-full w-px bg-zinc-800" aria-hidden />
      <div className="flex items-center gap-3">
        {state === "live" ? <Sparkle /> : null}
        <p
          className={
            state === "live"
              ? "text-lg text-zinc-200"
              : state === "done"
                ? "text-base text-zinc-400"
                : "text-base text-zinc-600"
          }
        >
          {NAMES[id]}
          {state === "waiting" ? (
            <span className="ml-3 text-sm text-zinc-700">waiting</span>
          ) : null}
          {state === "done" ? (
            <span className="ml-3 text-sm text-zinc-700">done</span>
          ) : null}
        </p>
      </div>

      {state === "live" && looking.length > 0 ? (
        <div className="mt-3 space-y-1">
          <p className="text-sm text-zinc-600">Looking at</p>
          {looking.map((line) => (
            <p key={line} className="text-[13px] leading-snug text-zinc-500">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {state === "done" && found.length > 0 ? (
        <div className="mt-3 space-y-1">
          <p className="text-sm text-zinc-600">Found</p>
          {found.map((line) => (
            <p key={line} className="text-[13px] leading-snug text-zinc-500">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {handoff ? (
        <p className="mt-3 text-[13px] leading-snug text-zinc-500">
          Handoff → {handoff.to}
          <span className="mt-1 block text-zinc-600">{handoff.note}</span>
        </p>
      ) : null}
    </div>
  );
}

export function Looking({
  phase,
  thoughts = [],
  spark,
}: {
  phase: SparkPhase;
  thoughts?: SparkThought[];
  spark?: string;
}) {
  const seats: SeatId[] = ["scout", "contrarian", "planner"];
  return (
    <div>
      {spark ? (
        <FadeIn className="mb-8 line-clamp-2 text-sm text-zinc-600">{spark}</FadeIn>
      ) : null}
      <div className="space-y-8">
        {seats.map((id) => (
          <Seat
            key={id}
            id={id}
            state={seatState(id, phase)}
            found={foundFor(id, thoughts)}
          />
        ))}
      </div>
    </div>
  );
}
