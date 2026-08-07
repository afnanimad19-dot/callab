// Agent editor types and defaults. Kept free of any Node-only imports so
// client components can use them (db.ts re-exports for server code).

export interface AgentOutcome {
  name: string;
  description: string;
  possibleValues?: string[]; // e.g. ["General Practitioner", "Physiotherapy"]
}

// Conversation tools the agent can call mid-call (Vapi parity — e.g. End Call).
export interface AgentTool {
  id: string;
  title: string; // display name, e.g. "End Call"
  name: string; // tool id the model calls, e.g. "end_call"
  description: string;
  aiResponse: string; // what the agent says when using the tool
}

export const DEFAULT_TOOLS: AgentTool[] = [
  {
    id: "tool_end_call",
    title: "End Call",
    name: "end_call",
    description: "Allows the AI agent to end the current call",
    aiResponse: "Say goodbye and wish the caller a great day.",
  },
];

export interface AgentAdvanced {
  // Agent Speaking (voice activity detection)
  minSpeechDuration: number; // 0.1–3s
  minSilenceDuration: number; // 0.1–3s
  activationThreshold: number; // 0.1–0.9
  prefixPadding: number; // 0.1–3s
  endOfSpeechTimeout: number; // 0–3s
  // Turn detection
  turnDetection: boolean;
  turnDetectionMode: "smart" | "fixed";
  turnDetectionTimeout: number; // 0–5s
  // Noise reduction
  noiseReduction: boolean;
  noiseReductionLevel: "low" | "medium" | "high";
  // Answering machine detection
  amd: boolean;
  amdMultilingual: boolean;
  amdTimeout: number; // 10–60s
  // Reminder & call duration
  silenceBeforeCheck: number; // seconds
  maxCheckAttempts: number;
  maxSilenceDuration: number; // seconds
  maxCallDuration: number; // minutes
  // Privacy
  dataStorage: "store" | "transcripts_only" | "none";
  // Stop speaking plan (how user speech interrupts the assistant) — Vapi parity
  stopSpeakingNumWords: number; // 0–10 words before assistant stops
  stopSpeakingVoiceSeconds: number; // 0–0.5s of user voice that counts as interruption
  stopSpeakingBackoffSeconds: number; // 0–10s before assistant may speak again
  // Messaging — Vapi parity
  voicemailMessage: string; // spoken when voicemail is detected ("" = hang up)
  endCallMessage: string; // spoken right before ending the call
  endCallPhrases: string; // comma-separated phrases that end the call
  idleMessage: string; // spoken when the caller goes idle
  idleTimeout: number; // 5–60s of silence before the idle message
  idleMaxCount: number; // 1–10 idle messages before hanging up
  // Keypad input (DTMF) — Vapi parity
  keypadInputEnabled: boolean;
  keypadInputTimeout: number; // 0.5–10s to wait for more digits
  keypadInputDelimiter: "#" | "*" | "both";
}

export const DEFAULT_ADVANCED: AgentAdvanced = {
  minSpeechDuration: 0.1,
  minSilenceDuration: 0.3,
  activationThreshold: 0.5,
  prefixPadding: 0.2,
  endOfSpeechTimeout: 0.2,
  turnDetection: true,
  turnDetectionMode: "smart",
  turnDetectionTimeout: 2,
  noiseReduction: false,
  noiseReductionLevel: "medium",
  amd: false,
  amdMultilingual: false,
  amdTimeout: 10,
  silenceBeforeCheck: 60,
  maxCheckAttempts: 3,
  maxSilenceDuration: 120,
  maxCallDuration: 60,
  dataStorage: "store",
  stopSpeakingNumWords: 0,
  stopSpeakingVoiceSeconds: 0.2,
  stopSpeakingBackoffSeconds: 1,
  voicemailMessage: "",
  endCallMessage: "Thank you for your time. Goodbye!",
  endCallPhrases: "goodbye, bye for now",
  idleMessage: "Are you still there?",
  idleTimeout: 10,
  idleMaxCount: 3,
  keypadInputEnabled: false,
  keypadInputTimeout: 2,
  keypadInputDelimiter: "#",
};
