// Voice-engine presets and the model choices behind them. Shared by the agent
// editor (UI) and the assistant sync (what actually gets sent to the voice
// pipeline). A preset is a one-click bundle of LLM + transcriber + TTS model;
// each part can still be overridden individually on the agent.

export type SpeedPreset = "balanced" | "high_intelligence" | "ultra_fast" | "cost_saver";

export const SPEED_PRESETS: { key: SpeedPreset; label: string; desc: string }[] = [
  { key: "balanced", label: "Balanced", desc: "Great quality and speed for everyday calls." },
  { key: "high_intelligence", label: "High Intelligence", desc: "Smartest model for complex conversations." },
  { key: "ultra_fast", label: "Ultra Fast", desc: "Lowest latency for snappy back-and-forth." },
  { key: "cost_saver", label: "Cost Saver", desc: "Lowest cost per minute for high call volumes." },
];

// LLM options exposed in the editor. value is "provider:model".
export const LLM_OPTIONS: { value: string; label: string }[] = [
  { value: "openai:gpt-4o", label: "GPT-4o — smart, balanced" },
  { value: "openai:gpt-4o-mini", label: "GPT-4o mini — fast, low cost" },
  { value: "anthropic:claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet — strong reasoning" },
  { value: "anthropic:claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku — fast, low cost" },
];

// Deepgram transcriber models.
export const TRANSCRIBER_OPTIONS: { value: string; label: string }[] = [
  { value: "nova-2", label: "Nova-2 — recommended, multilingual" },
  { value: "nova-3", label: "Nova-3 — newest" },
];

// ElevenLabs TTS models (same voice can use any of these).
export const VOICE_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5 — fast, 30+ languages" },
  { value: "eleven_multilingual_v2", label: "Multilingual v2 — highest quality" },
  { value: "eleven_flash_v2_5", label: "Flash v2.5 — ultra fast, lowest cost" },
];

export interface PresetConfig {
  llm: string; // "provider:model"
  voiceModel: string;
  transcriberModel: string;
}

// Defaults use Anthropic (Claude) because that's the provider key configured in
// Vapi for voice — so voice keeps working out of the box. Pick GPT-4o etc. only
// if you've also added that provider's key in your Vapi dashboard.
export function presetConfig(preset?: SpeedPreset): PresetConfig {
  switch (preset) {
    case "high_intelligence":
      return { llm: "anthropic:claude-3-5-sonnet-20241022", voiceModel: "eleven_multilingual_v2", transcriberModel: "nova-2" };
    case "ultra_fast":
      return { llm: "anthropic:claude-3-5-haiku-20241022", voiceModel: "eleven_flash_v2_5", transcriberModel: "nova-2" };
    case "cost_saver":
      return { llm: "anthropic:claude-3-5-haiku-20241022", voiceModel: "eleven_flash_v2_5", transcriberModel: "nova-2" };
    case "balanced":
    default:
      return { llm: "anthropic:claude-3-5-sonnet-20241022", voiceModel: "eleven_turbo_v2_5", transcriberModel: "nova-2" };
  }
}

// Resolve the agent's effective engine: explicit per-field overrides win,
// otherwise fall back to the preset (default "balanced").
export function resolveEngine(agent: {
  speedPreset?: SpeedPreset;
  llmModel?: string;
  voiceModel?: string;
  transcriberModel?: string;
}): { provider: string; model: string; voiceModel: string; transcriberModel: string } {
  const preset = presetConfig(agent.speedPreset);
  const llm = agent.llmModel || preset.llm;
  const [provider, ...rest] = llm.split(":");
  return {
    provider: provider || "openai",
    model: rest.join(":") || "gpt-4o",
    voiceModel: agent.voiceModel || preset.voiceModel,
    transcriberModel: agent.transcriberModel || preset.transcriberModel,
  };
}
