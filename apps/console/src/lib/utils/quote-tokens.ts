import { randomUUID } from "crypto";

export function generateAcceptToken(): string {
  return `qt_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
