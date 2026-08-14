"use client";

import { useEffect, useState } from "react";
import type { SparkView } from "@/lib/agent-schemas";
import { listRemembered } from "@/lib/browser-history";
import { agentBrief } from "@/lib/packet-brief";

function stamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function planMarkdown(row: SparkView): string {
  if (row.packet) {
    return agentBrief({
      spark: row.text,
      take: row.take,
      hours: row.hours,
      packet: row.packet,
    }).trimEnd();
  }
  const parts = ["Spark", row.text.trim()];
  if (row.take?.trim()) parts.push("", "Route", row.take.trim());
  if (row.hours?.trim()) parts.push("", "Budget", row.hours.trim());
  return parts.join("\n");
}

function allMarkdown(rows: SparkView[]): string {
  if (rows.length === 0) return "Nothing in this browser yet.\n";
  return rows.map(planMarkdown).join("\n\n---\n\n") + "\n";
}

function download(name: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function PlansExport() {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(listRemembered().length);
  }, []);

  function rows(): SparkView[] {
    return listRemembered();
  }

  return (
    <section className="space-y-8">
      <p className="text-base text-zinc-500">Plans</p>
      <p className="text-sm text-zinc-600">
        Plans live in this browser. Clearing cache or site data deletes them.
      </p>
      <p className="flex items-center gap-6 text-sm">
        <button
          type="button"
          className="foundry-ink text-zinc-400 hover:text-zinc-200"
          onClick={() => download(`foundry-${stamp()}.md`, allMarkdown(rows()), "text/markdown;charset=utf-8")}
        >
          export
        </button>
        <button
          type="button"
          className="foundry-ink text-zinc-600 hover:text-zinc-300"
          onClick={() =>
            download(
              `foundry-${stamp()}.json`,
              JSON.stringify(rows(), null, 2) + "\n",
              "application/json;charset=utf-8",
            )
          }
        >
          json
        </button>
        {n > 0 ? <span className="text-zinc-700">{n} here</span> : null}
      </p>
    </section>
  );
}
