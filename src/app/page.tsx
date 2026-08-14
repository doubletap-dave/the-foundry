import { Console } from "@/components/console";
import { hasAnyKey } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export default function HomePage() {
  return <Console hasKey={hasAnyKey()} />;
}
