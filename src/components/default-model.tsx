"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { loadOneCatalog, saveModelConfigs } from "@/app/actions";
import { readBrowserKeys } from "@/lib/browser-keys";
import { readBrowserModel, writeBrowserModel } from "@/lib/browser-model";
import {
  PROVIDER_IDS,
  PROVIDERS,
  defaultModelFor,
  providerLabel,
  type CatalogEntry,
  type Provider,
} from "@/lib/models";
import { cn } from "@/lib/utils";

function keyedFromBrowser(): Provider[] {
  const bag = readBrowserKeys();
  return PROVIDER_IDS.filter((id) => Boolean(bag[id]));
}

function parentIdOf(id: string, ids: string[]): string | null {
  let best: string | null = null;
  for (const other of ids) {
    if (other === id) continue;
    if (id.startsWith(`${other}-`) || id.startsWith(`${other}/`)) {
      if (!best || other.length > best.length) best = other;
    }
  }
  return best;
}

function nestModels(list: CatalogEntry[]): { entry: CatalogEntry; child: boolean }[] {
  const ids = list.map((m) => m.id);
  const kids = new Map<string, CatalogEntry[]>();
  const roots: CatalogEntry[] = [];
  for (const m of list) {
    const parent = parentIdOf(m.id, ids);
    if (parent) {
      const arr = kids.get(parent) ?? [];
      arr.push(m);
      kids.set(parent, arr);
    } else {
      roots.push(m);
    }
  }
  const out: { entry: CatalogEntry; child: boolean }[] = [];
  function emit(m: CatalogEntry, child: boolean) {
    out.push({ entry: m, child });
    for (const k of kids.get(m.id) ?? []) emit(k, true);
  }
  for (const m of roots) emit(m, false);
  return out;
}

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
  const [keyed, setKeyed] = useState<Provider[]>(() =>
    PROVIDER_IDS.filter((id) => keySet[id]),
  );
  const [looking, setLooking] = useState(false);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const fetchFor = useRef<Provider | null>(null);

  useEffect(() => {
    function sync() {
      const next = keyedFromBrowser();
      setKeyed(next);
      const stored = readBrowserModel();
      if (stored && (next.length === 0 || next.includes(stored.provider))) {
        setProvider(stored.provider);
        setModel(stored.model);
        return;
      }
      if (next.length === 1) {
        const only = next[0];
        setProvider(only);
        if (!stored) {
          const mid = defaultModelFor(only);
          setModel(mid);
          writeBrowserModel({ provider: only, model: mid });
        }
        return;
      }
      if (next.length > 1) {
        setProvider((current) => (next.includes(current) ? current : next[0]));
      }
    }
    sync();
    window.addEventListener("foundry-keys", sync);
    window.addEventListener("foundry-model", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("foundry-keys", sync);
      window.removeEventListener("foundry-model", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    setFilter("");
  }, [provider]);

  useEffect(() => {
    if (!keyed.includes(provider)) {
      setLooking(false);
      return;
    }
    if ((catalogs[provider] ?? []).length > 0) {
      setLooking(false);
      return;
    }
    const key = readBrowserKeys()[provider];
    if (!key) {
      setLooking(false);
      return;
    }
    if (fetchFor.current === provider) return;
    fetchFor.current = provider;
    let cancelled = false;
    setLooking(true);
    setErr(null);
    void loadOneCatalog(provider, readBrowserKeys()[provider]).then((result) => {
      if (fetchFor.current === provider) fetchFor.current = null;
      if (cancelled) return;
      setLooking(false);
      if ("models" in result && result.models) {
        setCatalogs((prev) => ({ ...prev, [provider]: result.models }));
        setModel((current) => {
          if (result.models.some((m) => m.id === current)) return current;
          return result.models[0]?.id ?? defaultModelFor(provider);
        });
      } else if ("error" in result) {
        setErr(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, keyed, catalogs]);

  function pickProvider(p: Provider) {
    if (p === provider) return;
    setProvider(p);
    const first = (catalogs[p] ?? [])[0];
    const nextModel = first?.id ?? defaultModelFor(p);
    setModel(nextModel);
    setErr(null);
    writeBrowserModel({ provider: p, model: nextModel });
  }

  function pickModel(id: string) {
    setModel(id);
    setErr(null);
    writeBrowserModel({ provider, model: id });
    start(async () => {
      const result = await saveModelConfigs({
        configs: [{ role: "default", provider, model: id }],
      });
      if ("error" in result) {
        setErr(result.error);
      }
    });
  }

  const list = catalogs[provider] ?? [];
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? list.filter(
        (m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q),
      )
    : list;
  const nested = nestModels(filtered);

  if (keyed.length === 0) {
    return <p className="text-sm text-zinc-600">Add a key first.</p>;
  }

  return (
    <div className="space-y-4">
      {keyed.length === 1 ? (
        <p className="text-sm text-zinc-600">{providerLabel(keyed[0])}</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {PROVIDERS.filter((p) => keyed.includes(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickProvider(p.id)}
              className={cn(
                "text-sm",
                provider === p.id ? "text-ember" : "text-zinc-600 hover:text-zinc-300",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {looking ? <p className="text-sm text-zinc-600">looking up models.</p> : null}

      {err ? (
        <p className="text-sm text-zinc-500">{err}</p>
      ) : (
        <p className="text-sm text-zinc-500">
          {saving ? `Saving ${model}…` : `Using ${model}.`}
        </p>
      )}

      {list.length > 0 ? (
        <>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter"
            autoComplete="off"
            spellCheck={false}
            className="w-full max-w-md border-b border-zinc-800 bg-transparent py-2 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-500"
          />
          <ul className="max-h-72 overflow-auto">
            {nested.map(({ entry: m, child }) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pickModel(m.id)}
                  className={cn(
                    "w-full py-1.5 text-left text-sm hover:text-ember",
                    child && "pl-4",
                    m.id === model ? "text-ember" : "text-zinc-400",
                  )}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
