// Simulated live-call feed for the monitoring console.
//
// Generates deterministic "in-progress" calls whose transcripts advance in
// real time, so the supervision UI can be built and demoed end-to-end today.
// When real telephony lands, replace this with a WebSocket/SSE feed from the
// media pipeline (see README → Phase 3).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAgents } from "@/lib/db";

interface LiveTurn {
  speaker: "agent" | "caller";
  text: string;
}

const SCRIPTS: { topic: string; turns: LiveTurn[] }[] = [
  {
    topic: "Appointment scheduling",
    turns: [
      { speaker: "agent", text: "Thanks for calling — how can I help you today?" },
      { speaker: "caller", text: "Hi, do you have anything open this week for a consultation?" },
      { speaker: "agent", text: "Let me check the calendar… I have Wednesday 3 PM or Thursday 10 AM." },
      { speaker: "caller", text: "Thursday morning works better for me." },
      { speaker: "agent", text: "You're booked for Thursday at 10 AM. Can I get your name for the appointment?" },
      { speaker: "caller", text: "It's Jordan Reyes." },
      { speaker: "agent", text: "Perfect, Jordan — you'll receive an SMS confirmation shortly. Anything else?" },
      { speaker: "caller", text: "No, that's everything. Thank you!" },
    ],
  },
  {
    topic: "Order status",
    turns: [
      { speaker: "agent", text: "Thanks for calling support — what can I help you with?" },
      { speaker: "caller", text: "I placed an order five days ago and it still hasn't shipped." },
      { speaker: "agent", text: "I'm sorry about the delay. Could you give me the order number?" },
      { speaker: "caller", text: "It's 7 7 3 1 9." },
      { speaker: "agent", text: "Thank you. Order 77319 left the warehouse this morning — tracking says delivery tomorrow by 8 PM." },
      { speaker: "caller", text: "Oh good. Why didn't I get a shipping email though?" },
      { speaker: "agent", text: "It looks like the email bounced. I've corrected the address and re-sent the tracking link." },
    ],
  },
  {
    topic: "Billing question",
    turns: [
      { speaker: "agent", text: "Thanks for calling — how can I help?" },
      { speaker: "caller", text: "My invoice this month is higher than usual and I don't understand why." },
      { speaker: "agent", text: "Let me open your latest invoice… I see an added usage charge of $42 from the premium tier." },
      { speaker: "caller", text: "I never asked for a premium tier. Can you remove it?" },
      { speaker: "agent", text: "I can't change billing myself, but I'm flagging a supervisor with the full context right now." },
      { speaker: "caller", text: "Fine, but I'd like this fixed today." },
    ],
  },
];

const CYCLE_SECONDS = 150; // each simulated call lasts ~2.5 minutes
const SECONDS_PER_TURN = 16;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agents = (await listAgents(session.userId)).filter(
    (a) => a.status === "active"
  );
  const now = Math.floor(Date.now() / 1000);

  const calls = SCRIPTS.map((script, i) => {
    // Stagger call starts so calls begin/end at different moments.
    const offset = (now + i * 47) % CYCLE_SECONDS;
    const agent = agents[i % Math.max(agents.length, 1)];
    if (!agent) return null;

    const turnsVisible = Math.min(
      script.turns.length,
      1 + Math.floor(offset / SECONDS_PER_TURN)
    );
    const finished = offset > script.turns.length * SECONDS_PER_TURN + 20;
    if (finished) return null;

    const isBillingConflict = script.topic === "Billing question";
    const nearEnd = turnsVisible >= script.turns.length - 1;

    return {
      id: `live_${i}_${Math.floor((now + i * 47) / CYCLE_SECONDS)}`,
      agentId: agent.id,
      agentName: agent.name,
      topic: script.topic,
      callerNumber: `+1 (415) 555-0${140 + i * 13}`,
      elapsedSec: offset,
      sentiment: isBillingConflict && turnsVisible > 3 ? "negative" : "positive",
      confidence: isBillingConflict && turnsVisible > 3 ? 0.58 : 0.93,
      needsAttention: isBillingConflict && turnsVisible > 3,
      status: nearEnd ? "wrapping_up" : "in_progress",
      transcript: script.turns.slice(0, turnsVisible),
    };
  }).filter(Boolean);

  return NextResponse.json({ calls, at: new Date().toISOString() });
}
