import { randomBytes } from "crypto";

export function id(prefix?: string): string {
  const raw = randomBytes(8).toString("hex");
  return prefix ? `${prefix}_${raw}` : raw;
}
