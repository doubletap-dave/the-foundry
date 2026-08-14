"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import anime from "@/vendor/anime.js";
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

function lineFor(phase: SparkPhase): string {
  const list = STATUS[phase];
  return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

function StatusLine({ phase }: { phase: SparkPhase }) {
  const el = useRef<HTMLParagraphElement>(null);
  const firstRef = useRef(true);
  const aliveRef = useRef(true);
  const [display, setDisplay] = useState(() => STATUS[phase][0]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    anime.remove(node);
    anime({
      targets: node,
      opacity: [0, 1],
      translateY: [8, 0],
      duration: 560,
      easing: "easeOutCubic",
    });
    return () => {
      anime.remove(node);
    };
  }, [display]);

  useEffect(() => {
    const next = lineFor(phase);
    const node = el.current;

    if (firstRef.current) {
      firstRef.current = false;
      setDisplay(next);
      return;
    }

    if (!node) {
      setDisplay(next);
      return;
    }

    anime.remove(node);
    anime({
      targets: node,
      opacity: [1, 0],
      translateY: [0, -6],
      duration: 320,
      easing: "easeInCubic",
      complete: () => {
        if (!aliveRef.current) return;
        setDisplay(next);
      },
    });

    return () => {
      if (el.current) anime.remove(el.current);
    };
  }, [phase]);

  return (
    <p ref={el} className="text-lg text-zinc-300" style={{ opacity: 0 }}>
      {display}
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
    anime.remove(node);
    anime({
      targets: node,
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 560,
      easing: "easeOutCubic",
      delay: 40,
    });
    return () => {
      anime.remove(node);
    };
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
  spark,
}: {
  phase: SparkPhase;
  thoughts?: SparkThought[];
  spark?: string;
}) {
  const cards = thoughts.filter((t) => t.lines.length > 0);
  return (
    <div>
      {spark ? (
        <FadeIn className="mb-8 line-clamp-2 text-sm text-zinc-600">{spark}</FadeIn>
      ) : null}
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
