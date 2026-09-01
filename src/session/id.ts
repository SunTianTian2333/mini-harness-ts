import { randomBytes } from "node:crypto";

export function generateSessionId(): string {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = randomBytes(3).toString("hex");
  return `sess_${ts}_${rand}`;
}
