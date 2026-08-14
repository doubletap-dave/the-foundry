"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  advanceSpark,
  killSpark,
  listBuilt,
  markSparkBuilt,
  mutateSpark,
  rateLegs,
  readSpark,
  refineSpark,
  submitSpark,
  writePacket,
} from "@/app/actions";
import type { SparkView } from "@/lib/agent-schemas";
import { browserHasKeys, readBrowserKeys } from "@/lib/browser-keys";
import { readBrowserModel } from "@/lib/browser-model";
import { Md } from "@/components/md";
import { pickSaying } from "@/lib/sayings";
import { FadeIn, Looking } from "@/components/looking";
import { ink } from "@/lib/motion";

const STORE = "foundry.sparkId";

function displayError(error: string): string {
  return error
    .replace(/\s*at\s*\/settings\.?/gi, ".")
    .replace(/\/settings/gi, "")
    .replace(/\s+\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function keyRelated(error: string): boolean {
  return /key/i.test(error);
}

function isSettingsCommand(raw: string): boolean {
  const t = raw.trim();
  const lower = t.toLowerCase();
  return (
    lower === "keys" ||
    t === ":" ||
    t === "π" ||
    lower === "pi" ||
    lower === "settings" ||
    lower === "/settings" ||
    lower === "/keys"
  );
}

function SettingsWord({ className }: { className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const rest = "#a1a1aa";
  const lit = "#e4e4e7";
  return (
    <Link
      href="/settings"
      ref={ref}
      className={className ?? "text-zinc-400"}
      style={{ color: rest }}
      onMouseEnter={() => ink(ref.current, lit)}
      onMouseLeave={() => ink(ref.current, rest)}
    >
      settings
    </Link>
  );
}

function InkLink({
  href,
  rest,
  lit,
  className,
  children,
  title,
  external,
}: {
  href: string;
  rest: string;
  lit: string;
  className?: string;
  children: ReactNode;
  title?: string;
  external?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const cls = className ?? "text-lg";
  const handlers = {
    style: { color: rest },
    onMouseEnter: () => ink(ref.current, lit),
    onMouseLeave: () => ink(ref.current, rest),
  };
  if (external) {
    return (
      <a ref={ref} href={href} target="_blank" rel="noreferrer" title={title} className={cls} {...handlers}>
        {children}
      </a>
    );
  }
  return (
    <Link ref={ref} href={href} title={title} className={cls} {...handlers}>
      {children}
    </Link>
  );
}


function BuiltMark({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const rest = "#52525b";
  const lit = "#d4d4d8";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="text-lg"
      style={{ color: rest }}
      onMouseEnter={() => ink(ref.current, lit)}
      onMouseLeave={() => ink(ref.current, rest)}
    >
      built
    </button>
  );
}

function PiMark() {
  const ref = useRef<HTMLAnchorElement>(null);
  const rest = "#52525b";
  const lit = "#d4d4d8";
  return (
    <Link
      ref={ref}
      href="/settings"
      title="keys"
      className="foundry-pi relative inline-flex h-7 w-7 items-center justify-center text-lg"
      style={{ color: rest }}
      onMouseEnter={() => ink(ref.current, lit)}
      onMouseLeave={() => ink(ref.current, rest)}
    >
      π
      <span className="foundry-pi-glint" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
    </Link>
  );
}

function FakeCaret({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      aria-hidden
      className="foundry-caret pointer-events-none absolute left-0 top-[0.2em] h-[1.15em] w-0.5 bg-ember"
    />
  );
}

type Screen = "empty" | "looking" | "ready" | "packet" | "legs" | "log";

function screenFrom(spark: SparkView): Screen {
  switch (spark.status) {
    case "looking":
      return "looking";
    case "ready":
      return spark.take ? "ready" : "looking";
    case "building":
      return spark.packet ? "packet" : "looking";
    case "built":
      return "legs";
    default:
      return "empty";
  }
}

function WordButton({
  children,
  onClick,
  disabled,
  dim,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dim?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const rest = dim ? "#71717a" : "#d4d4d8";
  const lit = dim ? "#e4e4e7" : "#e08a55";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-lg disabled:opacity-40 md:text-xl"
      style={{ color: rest }}
      onMouseEnter={() => {
        if (!disabled) ink(ref.current, lit);
      }}
      onMouseLeave={() => ink(ref.current, rest)}
    >
      {children}
    </button>
  );
}

function snapOf(spark: SparkView) {
  return { text: spark.text, take: spark.take, hours: spark.hours };
}


function HomeMark({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const rest = "#71717a";
  const lit = "#e4e4e7";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="absolute left-6 top-6 text-2xl font-medium tracking-tight md:text-3xl lg:text-4xl"
      style={{ color: rest }}
      onMouseEnter={() => ink(ref.current, lit)}
      onMouseLeave={() => ink(ref.current, rest)}
    >
      The Foundry
    </button>
  );
}

export function Console({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [screen, setScreen] = useState<Screen>("empty");
  const [spark, setSpark] = useState<SparkView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [phaseHint, setPhaseHint] = useState<"packet" | null>(null);
  const [built, setBuilt] = useState<SparkView[]>([]);
  const [localHas, setLocalHas] = useState(false);
  const [keysReady, setKeysReady] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const effectiveHasKey = hasKey || localHas;

  const goEmpty = useCallback(() => {
    setScreen("empty");
    setSpark(null);
    setText("");
    setError(null);
    setPending(false);
    setPhaseHint(null);
    try {
      sessionStorage.removeItem(STORE);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => areaRef.current?.focus());
  }, []);

  const openLog = useCallback(async () => {
    setError(null);
    setScreen("log");
    try {
      setBuilt(await listBuilt());
    } catch {
      setBuilt([]);
    }
  }, []);

  const applySpark = useCallback((next: SparkView) => {
    setSpark(next);
    if (next.status === "error") {
      setError(next.error || "Something broke.");
      setScreen(next.take ? "ready" : "empty");
      return;
    }
    setError(null);
    const s = screenFrom(next);
    setScreen(s);
    if (s !== "looking") setPhaseHint(null);
    else if (next.phase === "packet") setPhaseHint(null);
  }, []);

  useEffect(() => {
    setLocalHas(browserHasKeys());
    setKeysReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const id = sessionStorage.getItem(STORE);
        if (!id) return;
        const row = await readSpark(id);
        if (cancelled) return;
        if (!row || row.status === "killed" || row.status === "rated") {
          sessionStorage.removeItem(STORE);
          return;
        }
        applySpark(row);
      } catch {
        /* ignore */
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [applySpark]);

  useEffect(() => {
    if (screen !== "looking" || !spark?.id) return;
    const sparkId = spark.id;
    let cancelled = false;
    let inFlight = false;

    async function tick() {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        await advanceSpark(sparkId, readBrowserKeys(), readBrowserModel());
        const row = await readSpark(sparkId);
        if (cancelled || !row) return;
        applySpark(row);
      } catch {
        /* keep polling */
      } finally {
        inFlight = false;
      }
    }

    const handle = window.setInterval(tick, 1400);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [screen, spark?.id, applySpark]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        router.push("/settings");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    if (screen === "empty") areaRef.current?.focus();
  }, [screen]);

  async function send() {
    const trimmed = text.trim();
    if (isSettingsCommand(trimmed)) {
      router.push("/settings");
      return;
    }
    if (trimmed === "built") {
      setText("");
      void openLog();
      return;
    }
    if (pending) return;
    setError(null);
    if (!effectiveHasKey) {
      setError("No keys.");
      return;
    }
    setPending(true);
    const result = await submitSpark(text, readBrowserKeys(), readBrowserModel());
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    try {
      sessionStorage.setItem(STORE, result.sparkId);
    } catch {
      /* ignore */
    }
    setPhaseHint(null);
    setSpark({
      id: result.sparkId,
      text: trimmed,
      status: "looking",
      take: null,
      hours: null,
      packet: null,
      legs: null,
      error: null,
      phase: "scout",
      thoughts: [],
    });
    setScreen("looking");
  }

  async function onBuild() {
    if (!spark) return;
    setPending(true);
    setError(null);
    setPhaseHint("packet");
    setSpark({ ...spark, status: "looking", packet: null, phase: "packet" });
    setScreen("looking");
    const result = await writePacket(spark.id, readBrowserKeys(), readBrowserModel(), snapOf(spark));
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      setPhaseHint(null);
      setSpark({ ...spark, status: "ready" });
      setScreen("ready");
    }
  }

  async function onWeirder() {
    if (!spark) return;
    setPending(true);
    setError(null);
    const result = await mutateSpark(spark.id, readBrowserKeys(), readBrowserModel(), snapOf(spark));
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setPhaseHint(null);
    setSpark({ ...spark, status: "looking", packet: null });
    setScreen("looking");
  }

  async function onRefine(note: string) {
    if (!spark) return;
    const trimmed = note.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    const result = await refineSpark(spark.id, trimmed, readBrowserKeys(), readBrowserModel(), snapOf(spark));
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setPhaseHint(null);
    setSpark({ ...spark, status: "looking", packet: null });
    setScreen("looking");
  }

  async function onNah() {
    if (spark) void killSpark(spark.id);
    goEmpty();
  }

  async function onBuilt() {
    if (!spark) return;
    setPending(true);
    await markSparkBuilt(spark.id);
    setPending(false);
    setScreen("legs");
  }

  async function onLegs(value: "yep" | "kinda" | "nope") {
    if (spark) await rateLegs(spark.id, value);
    goEmpty();
  }

  async function openBuilt(row: SparkView) {
    try {
      sessionStorage.setItem(STORE, row.id);
    } catch {
      /* ignore */
    }
    const fresh = (await readSpark(row.id)) ?? row;
    setSpark(fresh);
    setError(null);
    if (fresh.packet) setScreen("packet");
    else if (fresh.take) setScreen("ready");
    else setScreen("empty");
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <HomeMark onClick={goEmpty} />

      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="w-full max-w-2xl">
          {screen === "empty" ? (
            <Empty
              text={text}
              setText={setText}
              onSend={() => void send()}
              pending={pending}
              error={error}
              hasKey={effectiveHasKey}
              keysReady={keysReady}
              areaRef={areaRef}
            />
          ) : null}

          {screen === "looking" ? (
            <Looking
              phase={phaseHint === "packet" ? "packet" : spark?.phase ?? "scout"}
              thoughts={spark?.thoughts}
              spark={spark?.text}
            />
          ) : null}

          {screen === "ready" && spark?.take ? (
            <Ready
              spark={spark.text}
              take={spark.take}
              pending={pending}
              error={error}
              onBuild={() => void onBuild()}
              onWeirder={() => void onWeirder()}
              onNah={() => void onNah()}
              onRefine={(note) => void onRefine(note)}
            />
          ) : null}

          {screen === "packet" && spark?.packet ? (
            <PacketView
              spark={spark.text}
              take={spark.take}
              packet={spark.packet}
              status={spark.status}
              legs={spark.legs}
              pending={pending}
              onBuilt={() => void onBuilt()}
            />
          ) : null}

          {screen === "legs" ? (
            <Legs onPick={(v) => void onLegs(v)} />
          ) : null}

          {screen === "log" ? (
            <BuiltLog rows={built} onOpen={(row) => void openBuilt(row)} />
          ) : null}
        </div>
      </main>

      <footer className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <PiMark />
          <InkLink
            href="https://github.com/doubletap-dave/the-foundry"
            rest="#52525b"
            lit="#d4d4d8"
            external
          >
            github
          </InkLink>
        </div>
        <BuiltMark onClick={() => void openLog()} />
      </footer>
    </div>
  );
}

function Empty({
  text,
  setText,
  onSend,
  pending,
  error,
  hasKey,
  keysReady,
  areaRef,
}: {
  text: string;
  setText: (v: string) => void;
  onSend: () => void;
  pending: boolean;
  error: string | null;
  hasKey: boolean;
  keysReady: boolean;
  areaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [focused, setFocused] = useState(false);
  const [saying, setSaying] = useState<string | null>(null);
  const sayingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setSaying(pickSaying());
  }, []);

  useEffect(() => {
    const node = sayingRef.current;
    if (!node || !saying) return;
    node.getAnimations().forEach((a) => a.cancel());
    node.animate(
      [
        { opacity: 0 },
        { opacity: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
  }, [saying]);

  useEffect(() => {
    areaRef.current?.focus();
  }, [areaRef]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (pending) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" || e.key === "Tab") return;
      const el = areaRef.current;
      if (!el) return;
      if (document.activeElement === el) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      if (e.key.length === 1) {
        e.preventDefault();
        el.focus();
        setText(text + e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        el.focus();
        setText(text.slice(0, -1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [areaRef, pending, setText, text]);

  const shown = error ? displayError(error) : "";

  return (
    <div>
      <h1
        ref={sayingRef}
        className="mb-8 min-h-[1.2em] text-3xl font-medium tracking-tight text-zinc-100 md:text-4xl"
        style={{ opacity: 0 }}
      >
        {saying ?? '\u00a0'}
      </h1>
      <div className="relative">
        <FakeCaret show={text.length === 0 && !focused} />
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={5}
          spellCheck={false}
          className="caret-ember w-full resize-none bg-transparent text-xl leading-relaxed text-zinc-200 outline-none md:text-2xl"
        />
      </div>
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-600">
          {error ? (
            <span className="text-zinc-400">
              {shown}{" "}
              {keyRelated(error) ? (
                <SettingsWord className="text-ember hover:text-ember-glow" />
              ) : null}
            </span>
          ) : !hasKey && keysReady ? (
            <span>
              No keys. <SettingsWord />
            </span>
          ) : (
            <span className="opacity-0">.</span>
          )}
        </p>
        <button
          type="button"
          onClick={onSend}
          disabled={pending || text.trim().length === 0}
          className="text-sm text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
        >
          ↵
        </button>
      </div>
    </div>
  );
}

function Ready({
  spark,
  take,
  pending,
  error,
  onBuild,
  onWeirder,
  onNah,
  onRefine,
}: {
  spark: string;
  take: string;
  pending: boolean;
  error: string | null;
  onBuild: () => void;
  onWeirder: () => void;
  onNah: () => void;
  onRefine: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [focused, setFocused] = useState(false);
  const followRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => followRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (pending) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" || e.key === "Tab") return;
      const el = followRef.current;
      if (!el) return;
      if (document.activeElement === el) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      if (e.key.length === 1) {
        e.preventDefault();
        el.focus();
        setNote((n) => n + e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        el.focus();
        setNote((n) => n.slice(0, -1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const shown = error ? displayError(error) : "";

  return (
    <div>
      {spark ? (
        <FadeIn className="mb-8 line-clamp-2 text-sm text-zinc-600">{spark}</FadeIn>
      ) : null}
      <Md className="text-xl leading-relaxed text-zinc-200 md:text-2xl md:leading-relaxed">
        {take}
      </Md>
      {error ? (
        <p className="mt-6 text-sm text-zinc-500">
          {shown}{" "}
          {keyRelated(error) ? (
            <SettingsWord className="text-ember hover:text-ember-glow" />
          ) : null}
        </p>
      ) : null}
      <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3">
        <WordButton onClick={onBuild} disabled={pending}>
          Build it
        </WordButton>
        <WordButton onClick={onWeirder} disabled={pending} dim>
          Make it weirder
        </WordButton>
        <WordButton onClick={onNah} disabled={pending} dim>
          Nah
        </WordButton>
      </div>
      <div className="relative mt-10">
        <FakeCaret show={note.length === 0 && !focused} />
        <textarea
          ref={followRef}
          value={note}
          autoFocus
          onChange={(e) => setNote(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const trimmed = note.trim();
              if (!trimmed || pending) return;
              onRefine(trimmed);
              setNote("");
            }
          }}
          rows={2}
          spellCheck={false}
          disabled={pending}
          className="caret-ember w-full resize-none bg-transparent text-lg leading-relaxed text-zinc-200 outline-none disabled:opacity-40"
        />
      </div>
    </div>
  );
}

function PacketView({
  spark,
  take,
  packet,
  status,
  legs,
  pending,
  onBuilt,
}: {
  spark?: string;
  take: string | null;
  packet: NonNullable<SparkView["packet"]>;
  status: string;
  legs: string | null;
  pending: boolean;
  onBuilt: () => void;
}) {
  const done = status === "built" || status === "rated";
  const blocks: { k: string; v: string }[] = [
    { k: "build", v: packet.build },
    { k: "don’t", v: packet.dont },
    { k: "stack", v: packet.stack },
    { k: "stop when", v: packet.stopWhen },
  ];
  if (packet.files?.trim()) {
    blocks.push({ k: "exists when", v: packet.files });
  }
  return (
    <div className="space-y-10">
      {spark ? (
        <FadeIn className="line-clamp-2 text-sm text-zinc-600">{spark}</FadeIn>
      ) : null}
      {take ? (
        <Md className="text-xl leading-relaxed text-zinc-200 md:text-2xl">{take}</Md>
      ) : null}
      {blocks.map((b) => (
        <div key={b.k}>
          <p className="mb-2 text-sm text-zinc-500">
            {b.k}
          </p>
          <Md className="text-lg leading-relaxed text-zinc-200">{b.v}</Md>
        </div>
      ))}
      <div className="pt-4">
        {status === "building" ? (
          <WordButton onClick={onBuilt} disabled={pending}>
            I built it
          </WordButton>
        ) : done ? (
          <p className="text-sm text-zinc-500">
            {legs ? `legs · ${legs}` : "built"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Legs({ onPick }: { onPick: (v: "yep" | "kinda" | "nope") => void }) {
  return (
    <div>
      <h1 className="mb-10 text-3xl font-medium tracking-tight text-zinc-100">
        Did this have legs?
      </h1>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <WordButton onClick={() => onPick("yep")}>Yep</WordButton>
        <WordButton onClick={() => onPick("kinda")} dim>
          Kinda
        </WordButton>
        <WordButton onClick={() => onPick("nope")} dim>
          Nope
        </WordButton>
      </div>
    </div>
  );
}

function BuiltLog({
  rows,
  onOpen,
}: {
  rows: SparkView[];
  onOpen: (row: SparkView) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">Nothing built yet.</p>;
  }
  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-500">built</p>
      <ul className="space-y-6">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" onClick={() => onOpen(row)} className="block w-full text-left">
              <p className="text-lg leading-snug text-zinc-200 hover:text-zinc-50">{row.text}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {row.hours ?? "—"}
                {row.legs ? ` · ${row.legs}` : ""}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

