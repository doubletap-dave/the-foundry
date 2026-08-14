"use client";

import { type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-medium text-zinc-50">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic text-zinc-300">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="font-mono text-[0.92em] text-ember">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a
          key={i}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="text-ember underline decoration-ember/40 underline-offset-4 hover:text-ember-glow"
        >
          {link[1]}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function Md({ children, className }: { children: string; className?: string }) {
  const blocks = children.trim().split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const contentLines = lines.filter((l) => l.trim());
        const isUl =
          contentLines.length > 0 && contentLines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isUl) {
          return (
            <ul key={i} className="my-4 list-disc space-y-1 pl-5 last:mb-0">
              {contentLines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        const isOl =
          contentLines.length > 0 && contentLines.every((l) => /^\s*\d+\.\s+/.test(l));
        if (isOl) {
          return (
            <ol key={i} className="my-4 list-decimal space-y-1 pl-5 last:mb-0">
              {contentLines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="mb-4 last:mb-0">
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {inline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
