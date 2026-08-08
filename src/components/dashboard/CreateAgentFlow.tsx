"use client";

// "Create Agent" button + two-step modal:
//   Step 1: choose agent type (Single Prompt / Conversation Flow)
//   Step 2: choose a template or start from scratch
// Selecting a template navigates to the agent editor prefilled.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { Plus, FileText, Sparkles, MessageSquareText } from "lucide-react";

export const AGENT_TEMPLATES = [
  {
    key: "scratch",
    name: "Start from scratch",
    description: "Create a completely custom agent",
    icon: Plus,
  },
  {
    key: "healthcare",
    name: "Kate — Healthcare Agent",
    description: "Inbound healthcare agent for a clinic",
    icon: FileText,
  },
  {
    key: "realestate",
    name: "Megan — Real Estate Sales",
    description: "Outbound sales rep for property listings",
    icon: FileText,
  },
];

export default function CreateAgentFlow() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 = closed
  const [type, setType] = useState<"single_prompt" | "conversation_flow">("single_prompt");

  function pickType(t: "single_prompt" | "conversation_flow") {
    setType(t);
    setStep(2);
  }

  function pickTemplate(template: string) {
    setStep(0);
    router.push(`/dashboard/agents/new?type=${type}&template=${template}`);
  }

  return (
    <>
      <button onClick={() => setStep(1)} className="btn-primary">
        + Create Agent
      </button>

      <Modal
        open={step === 1}
        onClose={() => setStep(0)}
        title="Create New AI Agent"
        subtitle="Choose the type of AI agent you want to create."
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => pickType("single_prompt")}
            className="card card-hover flex flex-col items-center !p-8 text-center"
          >
            <MessageSquareText className="h-8 w-8 text-ink-300" />
            <span className="mt-4 text-base font-semibold">Single Prompt Agent</span>
            <span className="mt-1.5 text-sm text-ink-400">
              Create an agent with a single prompt for simpler interactions.
            </span>
          </button>
          <button
            onClick={() => pickType("conversation_flow")}
            className="card card-hover flex flex-col items-center !p-8 text-center"
          >
            <Sparkles className="h-8 w-8 text-ink-300" />
            <span className="mt-4 text-base font-semibold">Conversation Flow</span>
            <span className="mt-1.5 text-sm text-ink-400">
              Build a multi-step flow for complex conversations.
            </span>
          </button>
        </div>
      </Modal>

      <Modal
        open={step === 2}
        onClose={() => setStep(0)}
        title="Create New AI Agent"
        subtitle="Select a template or start from scratch."
        wide
      >
        <button
          onClick={() => setStep(1)}
          className="btn-secondary mb-4 !px-4 !py-1.5 !text-xs"
        >
          ← Back
        </button>
        <p className="mb-3 text-center text-sm font-medium text-ink-300">
          {type === "single_prompt" ? "Single Prompt Templates" : "Conversation Flow Templates"}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {AGENT_TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => pickTemplate(t.key)}
              className="card card-hover flex flex-col items-center !p-7 text-center"
            >
              <t.icon className="h-6 w-6 text-accent-400" />
              <span className="mt-3 text-sm font-semibold">{t.name}</span>
              <span className="mt-1 text-xs text-ink-400">{t.description}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
