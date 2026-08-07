"use client";

// "Test Agent" header button (next to + Create Agent) that opens the test panel.

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import type { Agent } from "@/lib/db";
import TestAgentPanel from "./TestAgentPanel";

export default function TestAgentButton({ agents }: { agents: Agent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={agents.length === 0}
        className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        title={agents.length === 0 ? "Create an agent first" : "Test an agent by text or voice"}
      >
        <FlaskConical className="h-4 w-4" /> Test Agent
      </button>
      {open && <TestAgentPanel agents={agents} onClose={() => setOpen(false)} />}
    </>
  );
}
