"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { loadOneCatalog, saveModelConfigs } from "@/app/actions";
import { readBrowserKeys } from "@/lib/browser-keys";
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
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const fetchFor = useRef<Provider | null>(null);

  useEffect(() => {
    function sync() {
      const next = keyedFromBrowser();
      setKeyed(next);
      setProvider((current) => {
        if (next.length === 0) return current;
        if (next.length === 1) return next[0];
        if (!next.includes(current)) return next[0];
        return current;
      });
    }
    sync();
    window.addEventListener("foundry-keys", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("foundry-keys", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

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
    setModel(first?.id ?? defaultModelFor(p));
    setSaved(false);
    setErr(null);
  }

  function pickModel(id: string) {
    setModel(id);
    setSaved(false);
    setErr(null);
    start(async () => {
      const result = await saveModelConfigs({
        configs: [{ role: "default", provider, model: id }],
      });
      if ("error" in result) {
        setErr(result.error);
        return;
      }
      setSaved(true);
    });
  }

  const list = catalogs[provider] ?? [];

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

      {list.length > 0 ? (
        <ul className="max-h-72 overflow-auto">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => pickModel(m.id)}
                className={cn(
                  "w-full py-1.5 text-left text-sm hover:text-ember",
                  m.id === model ? "text-ember" : "text-zinc-400",
                )}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {saved ? <p className="text-sm text-zinc-600">ok</p> : null}
      {err ? <p className="text-sm text-zinc-500">{err}</p> : null}
    </div>
  );
}
