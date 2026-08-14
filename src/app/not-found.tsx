import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="font-mono text-sm text-zinc-500">
        gone.{" "}
        <Link href="/" className="text-zinc-400 hover:text-zinc-200">
          /
        </Link>
      </p>
    </main>
  );
}
