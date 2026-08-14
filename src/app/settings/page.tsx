import Link from "next/link";
import { DefaultModel } from "@/components/default-model";
import { KeysForm } from "@/components/keys-form";
import { SettingsEsc } from "@/components/settings-esc";
import { type Provider } from "@/lib/models";
import { fetchAllCatalogs, listKeyStatuses } from "@/lib/providers";
import { listModelConfigs } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const stored = listModelConfigs();
  const keys = listKeyStatuses();
  const catalogs = await fetchAllCatalogs();
  const keySet = Object.fromEntries(keys.map((k) => [k.provider, k.set])) as Record<
    Provider,
    boolean
  >;
  const def = stored.find((row) => row.role === "default") ?? stored[0];
  return (
    <div className="relative min-h-screen px-6 py-20">
      <SettingsEsc />
      <Link
        href="/"
        className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-700 hover:text-zinc-400"
      >
        foundry
      </Link>
      <div className="mx-auto w-full max-w-lg space-y-16">
        <section className="space-y-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-600">keys</p>
          <p className="font-mono text-xs text-zinc-600">
            Keys stay in this browser. Never on the server.
          </p>
          <KeysForm initial={keys} />
        </section>
        <section className="space-y-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-600">model</p>
          <DefaultModel
            initial={{
              provider: (def?.provider ?? "openai") as Provider,
              model: def?.model ?? "gpt-4.1-mini",
            }}
            catalogs={catalogs}
            keySet={keySet}
          />
        </section>
        <p className="font-mono text-xs text-zinc-700">
          <Link href="/" className="hover:text-zinc-400">
            esc
          </Link>
        </p>
      </div>
    </div>
  );
}
