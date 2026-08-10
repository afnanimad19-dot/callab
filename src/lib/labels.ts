// User-facing display labels. The underlying voice provider is never named in
// the UI — numbers provisioned through the built-in pipeline show as "System".
export function providerLabel(provider: string): string {
  return provider === "Vapi" ? "System" : provider;
}
