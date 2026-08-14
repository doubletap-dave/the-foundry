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
        className="absolute left-6 top-6 text-2xl font-medium tracking-tight text-zinc-500 hover:text-zinc-200 md:text-3xl lg:text-4xl"
      >
        The Foundry
      </Link>
      <div className="mx-auto w-full max-w-lg space-y-16">
        <section className="space-y-8">
          <p className="text-base text-zinc-500">Keys</p>
          <p className="text-sm text-zinc-600">
            Keys stay in this browser. Never on the server.
          </p>
          <KeysForm initial={keys} />
        </section>
        <section className="space-y-8">
          <p className="text-base text-zinc-500">Model</p>
          <DefaultModel
            initial={{
              provider: (def?.provider ?? "openai") as Provider,
              model: def?.model ?? "gpt-4.1-mini",
            }}
            catalogs={catalogs}
            keySet={keySet}
          />
        </section>
        <p className="flex items-center gap-6 text-sm text-zinc-700">
          <Link href="/" className="hover:text-zinc-400">
            esc
          </Link>
          <a
            href="https://github.com/doubletap-dave/the-foundry"
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-400"
          >
            github
          </a>
        </p>
      </div>
    </div>
  );
}
