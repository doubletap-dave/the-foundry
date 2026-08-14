"use client";

import { useEffect, useState, useTransition } from "react";
import { testProviderKey } from "@/app/actions";
import {
  mergeKeyStatus,
  readBrowserKeys,
  writeBrowserKeys,
} from "@/lib/browser-keys";
import { PROVIDERS, type KeyStatus, type Provider } from "@/lib/models";

export function KeysForm({ initial }: { initial: KeyStatus[] }) {
  const [drafts, setDrafts] = useState<Record<Provider, string>>({
    openai: "",
    grok: "",
    openrouter: "",
    perplexity: "",
  });
  const [status, setStatus] = useState<KeyStatus[]>(initial);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setStatus(mergeKeyStatus(readBrowserKeys(), initial));
  }, [initial]);

  function row(provider: Provider): KeyStatus {
    return status.find((s) => s.provider === provider) ?? { provider, set: false, last4: "" };
  }

  function save(provider: Provider) {
    const value = drafts[provider].trim();
    if (!value) return;
    start(() => {
      setBusy(`save-${provider}`);
      setNote(null);
      const bag = { ...readBrowserKeys(), [provider]: value };
      writeBrowserKeys(bag);
      setDrafts((prev) => ({ ...prev, [provider]: "" }));
      setStatus(mergeKeyStatus(bag, initial));
      setBusy(null);
      setNote("ok");
    });
  }

  function clear(provider: Provider) {
    start(() => {
      setBusy(`clear-${provider}`);
      setNote(null);
      const bag = { ...readBrowserKeys() };
      delete bag[provider];
      writeBrowserKeys(bag);
      setStatus(mergeKeyStatus(bag, initial));
      setBusy(null);
      setNote("cleared");
    });
  }

  function test(provider: Provider) {
    start(async () => {
      setBusy(`test-${provider}`);
      setNote(null);
      const key = readBrowserKeys()[provider];
      const result = await testProviderKey(provider, key);
      setBusy(null);
      if ("error" in result) {
        setNote(result.error);
        return;
      }
      setNote("reachable");
    });
  }

  return (
    <div className="space-y-8">
      {PROVIDERS.map((p) => {
        const st = row(p.id);
        return (
          <div key={p.id} className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {p.label}
              {st.set ? <span className="ml-3 text-zinc-700">···{st.last4}</span> : null}
            </p>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={drafts[p.id]}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
              placeholder={st.set ? `set · ···${st.last4}` : "paste key"}
              className="w-full max-w-md border-b border-zinc-800 bg-transparent py-2 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-500"
            />
            <div className="flex flex-wrap items-center gap-5 pt-1">
              <button
                type="button"
                disabled={pending || !drafts[p.id].trim()}
                onClick={() => save(p.id)}
                className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
              >
                {busy === `save-${p.id}` ? "saving" : "save"}
              </button>
              {st.set ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => test(p.id)}
                    className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-600 hover:text-zinc-300 disabled:opacity-30"
                  >
                    {busy === `test-${p.id}` ? "testing" : "test"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => clear(p.id)}
                    className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-700 hover:text-zinc-400 disabled:opacity-30"
                  >
                    clear
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
      {note ? <p className="font-mono text-xs text-zinc-600">{note}</p> : null}
    </div>
  );
}
