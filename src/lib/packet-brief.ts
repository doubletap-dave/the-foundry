import type { Packet } from "@/lib/agent-schemas";

export function agentBrief({
  spark,
  take,
  hours,
  packet,
}: {
  spark?: string | null;
  take?: string | null;
  hours?: string | null;
  packet: Packet;
}): string {
  const parts: string[] = [
    "You are doing one sitting. Follow this brief exactly. Do not expand scope. Do not invent a product around it.",
  ];

  function section(label: string, value?: string | null) {
    const text = value?.trim();
    if (!text) return;
    parts.push("", label, text);
  }

  section("Spark", spark);
  section("Route", take);
  section("Budget", hours);
  section("Do", packet.build);
  section("Don't", packet.dont);
  section("Stack", packet.stack);
  section("Stop when", packet.stopWhen);
  section("Exists when", packet.files);

  return parts.join("\n") + "\n";
}
