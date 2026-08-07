// Agent editor types and defaults. Kept free of any Node-only imports so
// client components can use them (db.ts re-exports for server code).

export interface AgentOutcome {
  name: string;
  description: string;
}

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
};
