"use client";

// "Test Agent" header button (next to + Create Agent). Opens the Web Call
// popup — the animated voice-bubble experience — with an agent picker.

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import type { Agent } from "@/lib/db";
import { WebCallModal } from "./TestCallModals";

export default function TestAgentButton({ agents }: { agents: Agent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={agents.length === 0}
        className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        title={agents.length === 0 ? "Create an agent first" : "Talk to an agent in the browser"}
      >
        <FlaskConical className="h-4 w-4" /> Test Agent
      </button>
      {open && agents.length > 0 && (
        <WebCallModal agent={agents[0]} agents={agents} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
