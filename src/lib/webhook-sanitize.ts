// Shared sanitizer for webhook/integration step lists.

import { WebhookStep } from "./db";

export function sanitizeSteps(input: unknown): WebhookStep[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((s) => s && typeof s === "object")
    .map((s) => ({
      name: String((s as WebhookStep).name ?? "").slice(0, 80),
      method: ["POST", "GET", "PUT"].includes((s as WebhookStep).method)
        ? (s as WebhookStep).method
        : ("POST" as const),
      url: String((s as WebhookStep).url ?? "").slice(0, 500),
    }))
    .filter((s) => s.name || s.url)
    .slice(0, 15);
}
