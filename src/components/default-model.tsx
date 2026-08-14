"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { loadOneCatalog, saveModelConfigs } from "@/app/actions";
import { readBrowserKeys } from "@/lib/browser-keys";
import {
  PROVIDER_IDS,
  PROVIDERS,
  defaultModelFor,
  type CatalogEntry,
  type Provider,
} from "@/lib/models";
import { cn } from "@/lib/utils";

export function DefaultModel({
  initial,
  catalogs: initialCatalogs,
  keySet,
}: {
  initial: { provider: Provider; model: string };
  catalogs: Record<Provider, CatalogEntry[]>;
  keySet: Record<Provider, boolean>;
}) {
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [catalogs, setCatalogs] = useState(initialCatalogs);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [haveKey, setHaveKey] = useState(keySet);

  useEffect(() => {
    const bag = readBrowserKeys();
    setHaveKey((prev) => {
      const next = { ...prev };
      for (const id of PROVIDER_IDS) {
        if (bag[id]) next[id] = true;
      }
      return next;
    });
  }, []);

  const options = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = catalogs[provider] ?? [];
    return list.filter((m) => (q ? `${m.id} ${m.label}`.toLowerCase().includes(q) : true));
  }, [catalogs, provider, query]);

  function needCatalog(p: Provider) {
    if ((catalogs[p] ?? []).length > 0) return;
    if (!haveKey[p]) return;
    start(async () => {
      const result = await loadOneCatalog(p, readBrowserKeys()[p]);
      if ("models" in result && result.models) {
        setCatalogs((prev) => ({ ...prev, [p]: result.models }));
      }
    });
  }

  function pickProvider(p: Provider) {
    const first = (catalogs[p] ?? [])[0];
    setProvider(p);
    setModel(first?.id ?? defaultModelFor(p));
    setQuery("");
    setSaved(false);
    if (haveKey[p]) needCatalog(p);
  }

  function onSave() {
    setErr(null);
    start(async () => {
      const result = await saveModelConfigs({
        configs: [{ role: "default", provider, model }],
      });
      if ("error" in result) {
        setErr(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pickProvider(p.id)}
            className={cn(
              "font-mono text-xs uppercase tracking-[0.14em]",
              provider === p.id ? "text-ember" : "text-zinc-600 hover:text-zinc-300",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {!haveKey[provider] ? (
        <p className="font-mono text-xs text-zinc-600">Add a key first.</p>
      ) : (
        <div className="relative max-w-md">
          <input
            value={open ? query : model}
            onFocus={() => {
              setOpen(true);
              setQuery(model);
              needCatalog(provider);
            }}
            onChange={(e) => {
              setOpen(true);
              setQuery(e.target.value);
              setSaved(false);
            }}
            onBlur={() => {
              const typed = query.trim();
              if (typed && typed !== model) setModel(typed);
              window.setTimeout(() => setOpen(false), 120);
            }}
            spellCheck={false}
            className="w-full border-b border-zinc-800 bg-transparent py-2 font-mono text-sm text-zinc-200 outline-none focus:border-zinc-500"
          />
          {open ? (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto bg-zinc-950">
              {options.length === 0 ? (
                <li className="py-2 font-mono text-xs text-zinc-600">
                  {query.trim() ? `use “${query.trim()}”` : "type an id"}
                </li>
              ) : (
                options.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full py-1.5 text-left font-mono text-sm hover:text-ember",
                        m.id === model ? "text-ember" : "text-zinc-400",
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setModel(m.id);
                        setQuery("");
                        setOpen(false);
                        setSaved(false);
                      }}
                    >
                      {m.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
        >
          {pending ? "saving" : "save"}
        </button>
        {saved ? <span className="font-mono text-xs text-zinc-600">ok</span> : null}
        {err ? <span className="font-mono text-xs text-zinc-500">{err}</span> : null}
      </div>
    </div>
  );
}
