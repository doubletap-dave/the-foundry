"use client";

import { useEffect, useRef, useState } from "react";
import type { SparkPhase, SparkThought } from "@/lib/agent-schemas";

export type { SparkPhase, SparkThought };

const STATUS: Record<SparkPhase, string[]> = {
  scout: [
    "Looking around.",
    "Checking what already exists.",
    "Mapping the constraints.",
    "Finding the gaps.",
    "Sitting with the space.",
  ],
  contrarian: [
    "Killing the obvious version.",
    "Looking for the graveyard.",
    "Finding a stranger object.",
    "Turning it over.",
  ],
  interpret: [
    "Picking a route.",
    "Sharpening the take.",
    "Naming the interesting one.",
  ],
  packet: [
    "Writing the sitting plan.",
    "Laying out the first step.",
    "Deciding what not to build.",
    "Making it followable.",
  ],
};

const NAMES: Record<"scout" | "contrarian" | "maker", string> = {
  scout: "Scout",
  contrarian: "Contrarian",
  maker: "Maker",
};

function Sparkle() {
  return (
    <div className="foundry-sparkle shrink-0" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="rounded-none" />
      ))}
    </div>
  );
}

function StatusLine({ phase }: { phase: SparkPhase }) {
  const phrases = STATUS[phase];
  const el = useRef<HTMLParagraphElement>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
  }, [phase]);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    node.getAnimations().forEach((a) => a.cancel());
    node.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0px)" },
      ],
      { duration: 360, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
  }, [index, phase]);

  useEffect(() => {
    if (phrases.length < 2) return;
    const hold = window.setInterval(() => {
      const node = el.current;
      if (!node) return;
      node.getAnimations().forEach((a) => a.cancel());
      const out = node.animate(
        [
          { opacity: 1, transform: "translateY(0px)" },
          { opacity: 0, transform: "translateY(-6px)" },
        ],
        { duration: 240, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
      );
      out.onfinish = () => {
        indexRef.current = (indexRef.current + 1) % phrases.length;
        setIndex(indexRef.current);
      };
    }, 2200);
    return () => window.clearInterval(hold);
  }, [phase, phrases.length]);

  return (
    <p ref={el} className="text-lg text-zinc-300">
      {phrases[index] ?? phrases[0]}
    </p>
  );
}

function ThoughtCard({
  agent,
  lines,
}: {
  agent: "scout" | "contrarian" | "maker";
  lines: string[];
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    node.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0px)" },
      ],
      { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
  }, []);

  return (
    <div ref={el} className="border-l border-zinc-800 pl-3.5" style={{ opacity: 0 }}>
      <p className="text-sm text-zinc-600">{NAMES[agent]}</p>
      <div className="mt-1.5 space-y-1">
        {lines.map((line) => (
          <p key={line} className="text-[13px] leading-snug text-zinc-500">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

export function Looking({
  phase,
  thoughts = [],
}: {
  phase: SparkPhase;
  thoughts?: SparkThought[];
}) {
  const cards = thoughts.filter((t) => t.lines.length > 0);
  return (
    <div>
      <div className="flex items-center gap-5">
        <Sparkle />
        <StatusLine phase={phase} />
      </div>
      {cards.length > 0 ? (
        <div className="mt-8 space-y-6 pl-[44px]">
          {cards.map((t) => (
            <ThoughtCard key={t.agent} agent={t.agent} lines={t.lines} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
