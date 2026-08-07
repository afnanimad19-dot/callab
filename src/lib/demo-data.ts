// Seeds realistic demo data for a fresh account so every dashboard section is
// alive before real telephony (Vapi) is connected. Remove once live.

import {
  Agent,
  Call,
  Campaign,
  Contact,
  KnowledgeBase,
  PhoneNumber,
  TranscriptTurn,
  Webhook,
  newId,
} from "./db";

const CALLER_PREFIXES = ["+1 (415)", "+1 (212)", "+1 (737)", "+1 (305)", "+1 (206)"];

function phone(i: number): string {
  const prefix = CALLER_PREFIXES[i % CALLER_PREFIXES.length];
  const mid = String(200 + ((i * 37) % 700)).padStart(3, "0");
  const last = String(1000 + ((i * 613) % 9000)).padStart(4, "0");
  return `${prefix} ${mid}-${last}`;
}

interface CallTemplate {
  direction: "inbound" | "outbound";
  outcome: Call["outcome"];
  endReason: string;
  sentiment: Call["sentiment"];
  confidence: number;
  durationSec: number;
  summary: string;
  transcript: TranscriptTurn[];
}

const TEMPLATES: CallTemplate[] = [
  {
    direction: "inbound",
    outcome: "resolved",
    endReason: "caller ended the call",
    sentiment: "positive",
    confidence: 0.94,
    durationSec: 187,
    summary:
      "Caller asked to reschedule Thursday's appointment. Agent moved it to Friday 2:30 PM and sent an SMS confirmation.",
    transcript: [
      { speaker: "agent", text: "Thanks for calling — how can I help you today?", at: 2 },
      { speaker: "caller", text: "Hi, I need to move my appointment on Thursday, something came up.", at: 7 },
      { speaker: "agent", text: "No problem. I see your Thursday 10 AM slot. I have Friday at 11:15 or 2:30 — would either work?", at: 14 },
      { speaker: "caller", text: "2:30 on Friday is perfect.", at: 24 },
      { speaker: "agent", text: "Done — you're booked for Friday at 2:30 PM. I've texted a confirmation to this number. Anything else?", at: 30 },
      { speaker: "caller", text: "No, that's all. Thanks!", at: 39 },
    ],
  },
  {
    direction: "inbound",
    outcome: "escalated",
    endReason: "transferred to supervisor",
    sentiment: "negative",
    confidence: 0.61,
    durationSec: 342,
    summary:
      "Billing dispute over a duplicate charge. Sentiment dropped; supervisor took over the call and issued a refund.",
    transcript: [
      { speaker: "agent", text: "Thanks for calling, how can I help?", at: 2 },
      { speaker: "caller", text: "I've been charged twice this month and I want it fixed right now.", at: 6 },
      { speaker: "agent", text: "I'm sorry about that — let me pull up your billing history.", at: 13 },
      { speaker: "caller", text: "I already called about this last week. This is ridiculous.", at: 21 },
      { speaker: "supervisor", text: "Hi, this is Dana, a supervisor — I'm taking over from here. I can see the duplicate charge and I'm refunding it now.", at: 30 },
      { speaker: "caller", text: "Okay... thank you. I just want it resolved.", at: 44 },
      { speaker: "supervisor", text: "Completely understood. The refund is processed — you'll see it in 2–3 business days, and I've credited your next invoice 10%.", at: 52 },
    ],
  },
  {
    direction: "outbound",
    outcome: "callback_scheduled",
    endReason: "busy — callback booked",
    sentiment: "neutral",
    confidence: 0.88,
    durationSec: 96,
    summary:
      "Outbound follow-up on a quote request. Lead was busy; agent scheduled a callback for tomorrow morning.",
    transcript: [
      { speaker: "agent", text: "Hi, this is the assistant from the sales team following up on the quote you requested. Is now a good time?", at: 3 },
      { speaker: "caller", text: "I'm actually walking into a meeting — can you call tomorrow?", at: 11 },
      { speaker: "agent", text: "Of course. Would 9:30 AM tomorrow work?", at: 17 },
      { speaker: "caller", text: "Yeah, that works.", at: 22 },
      { speaker: "agent", text: "Great, I'll call you at 9:30 tomorrow. Have a good meeting!", at: 26 },
    ],
  },
  {
    direction: "inbound",
    outcome: "resolved",
    endReason: "agent ended the call",
    sentiment: "positive",
    confidence: 0.97,
    durationSec: 141,
    summary:
      "Caller asked about business hours and parking. Agent answered from the knowledge base and offered directions by SMS.",
    transcript: [
      { speaker: "agent", text: "Hello! How can I help you today?", at: 2 },
      { speaker: "caller", text: "What time are you open until on Saturdays? And is there parking nearby?", at: 6 },
      { speaker: "agent", text: "We're open until 6 PM on Saturdays, and there's a free lot behind the building on Oak Street. Want me to text you directions?", at: 14 },
      { speaker: "caller", text: "Sure, that'd be great.", at: 25 },
      { speaker: "agent", text: "Sent! Anything else I can help with?", at: 29 },
    ],
  },
  {
    direction: "inbound",
    outcome: "voicemail",
    endReason: "call terminated",
    sentiment: "neutral",
    confidence: 0.9,
    durationSec: 38,
    summary:
      "After-hours call. Agent took a message and created a follow-up task for the morning team.",
    transcript: [
      { speaker: "agent", text: "You've reached us after hours, but I can take a message and have the team call you first thing tomorrow.", at: 3 },
      { speaker: "caller", text: "Yes — my order hasn't arrived, order number 4482. Please call me back.", at: 12 },
      { speaker: "agent", text: "Got it. I've logged order 4482 as delayed and the team will call you before 10 AM tomorrow.", at: 24 },
    ],
  },
  {
    direction: "outbound",
    outcome: "resolved",
    endReason: "agent ended the call",
    sentiment: "positive",
    confidence: 0.92,
    durationSec: 204,
    summary:
      "Outbound lead qualification. Lead confirmed budget and timeline; marked as qualified and booked a demo with sales.",
    transcript: [
      { speaker: "agent", text: "Hi! You'd requested info about our service — do you have two minutes for a couple of quick questions?", at: 3 },
      { speaker: "caller", text: "Sure, go ahead.", at: 10 },
      { speaker: "agent", text: "Great. Roughly how many calls does your team handle per week?", at: 14 },
      { speaker: "caller", text: "Around three hundred, mostly support.", at: 21 },
      { speaker: "agent", text: "That's a great fit. I can book you a demo with our team — Thursday 1 PM or Friday 11 AM?", at: 28 },
      { speaker: "caller", text: "Thursday 1 PM works.", at: 38 },
      { speaker: "agent", text: "Booked! You'll get a calendar invite shortly.", at: 43 },
    ],
  },
];

const DEMO_AGENTS: Omit<Agent, "id" | "userId" | "createdAt">[] = [
  {
    name: "Front Desk",
    role: "Inbound reception & scheduling",
    voice: "Nova (female, warm)",
    language: "English (US)",
    greeting: "Thanks for calling — how can I help you today?",
    systemPrompt:
      "You are the front-desk assistant. Answer questions about hours, location, and services from the knowledge base. Book, move, and cancel appointments on the connected calendar. If the caller is upset or asks for a human, escalate to a supervisor immediately.",
    phoneNumber: "+1 (415) 555-0132",
    status: "active",
  },
  {
    name: "Support Line",
    role: "Tier-1 customer support",
    voice: "Atlas (male, calm)",
    language: "English (US)",
    greeting: "Thanks for calling support — what can I help you with?",
    systemPrompt:
      "You are a tier-1 support agent. Resolve order status, billing questions, and basic troubleshooting from the knowledge base. Never promise refunds yourself — escalate billing disputes to a human supervisor with full context.",
    phoneNumber: "+1 (415) 555-0198",
    status: "active",
  },
  {
    name: "Outbound SDR",
    role: "Lead qualification & follow-ups",
    voice: "Nova (female, warm)",
    language: "English (US)",
    greeting: "Hi! I'm following up on the request you sent us.",
    systemPrompt:
      "You are an outbound sales development rep. Qualify leads on budget, authority, need, and timeline. Book demos on the sales calendar. Always offer a callback if the lead is busy. Never call outside 9 AM – 6 PM in the lead's timezone.",
    phoneNumber: "+1 (415) 555-0177",
    status: "paused",
  },
];

const CONTACT_NAMES = [
  "Jordan Reyes", "Maya Patel", "Chris Delgado", "Sam Whitfield",
  "Aisha Rahman", "Leo Tanaka", "Priya Nair", "Omar Haddad",
];

export interface DemoData {
  agents: Agent[];
  calls: Call[];
  campaigns: Campaign[];
  contacts: Contact[];
  phoneNumbers: PhoneNumber[];
  webhooks: Webhook[];
  knowledgeBases: KnowledgeBase[];
}

export function seedDemoData(userId: string): DemoData {
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();

  const agents: Agent[] = DEMO_AGENTS.map((a) => ({
    ...a,
    id: newId("agt"),
    userId,
    createdAt: at(24 * 14),
  }));

  const campaigns: Campaign[] = [
    {
      id: newId("cmp"),
      userId,
      name: "Quote follow-ups — August",
      agentId: agents[2].id,
      agentName: agents[2].name,
      goal: "Call every lead who requested a quote in the last 30 days and book a demo.",
      status: "running",
      contactsTotal: 120,
      contactsCalled: 47,
      createdAt: at(24 * 5),
      updatedAt: at(24 * 1),
      direction: "outbound",
      phoneNumber: "+1 (415) 555-0177",
      schedule: {
        startDate: new Date(now - 5 * 86400_000).toISOString().slice(0, 10),
        endDate: "",
        from: "09:00",
        to: "17:00",
        days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        timezone: "America/New_York (GMT-5)",
        retryAttempts: true,
      },
      filters: { sources: ["Import"], tags: ["lead", "quote-request"], categories: [] },
    },
    {
      id: newId("cmp"),
      userId,
      name: "Front desk inbound line",
      agentId: agents[0].id,
      agentName: agents[0].name,
      goal: "Answer every inbound call to the main clinic number.",
      status: "scheduled",
      contactsTotal: 0,
      contactsCalled: 0,
      createdAt: at(24 * 2),
      updatedAt: at(24 * 2),
      direction: "inbound",
      phoneNumber: "+1 (415) 555-0132",
      syncWithContact: true,
    },
  ];

  const calls: Call[] = [];
  for (let i = 0; i < 28; i++) {
    const template = TEMPLATES[i % TEMPLATES.length];
    const agent = template.direction === "outbound" ? agents[2] : agents[i % 2];
    const hoursAgo = 2 + i * 5.7 + (i % 3) * 1.3;
    calls.push({
      id: newId("call"),
      userId,
      agentId: agent.id,
      agentName: agent.name,
      callerNumber: phone(i),
      direction: template.direction,
      startedAt: at(hoursAgo),
      durationSec: template.durationSec + (i % 5) * 11,
      outcome: template.outcome,
      endReason: template.endReason,
      sentiment: template.sentiment,
      confidence: Math.min(0.99, template.confidence + (i % 4) * 0.01),
      summary: template.summary,
      campaignId: template.direction === "outbound" ? campaigns[0].id : undefined,
      transcript: template.transcript,
    });
  }

  const contacts: Contact[] = CONTACT_NAMES.map((name, i) => ({
    id: newId("cnt"),
    userId,
    name,
    phone: phone(i + 40),
    tag: i % 3 === 0 ? "lead" : i % 3 === 1 ? "customer" : "quote-request",
    createdAt: at(24 * (10 - i)),
  }));

  const phoneNumbers: PhoneNumber[] = [
    { id: newId("num"), userId, number: "+1 (415) 555-0132", provider: "Vapi", agentName: "Front Desk", status: "active", createdAt: at(24 * 14), updatedAt: at(24 * 14), nickname: "Main reception line", numberType: "national", scope: "Global" },
    { id: newId("num"), userId, number: "+1 (415) 555-0198", provider: "Custom SIP Trunk", agentName: "Support Line", status: "active", createdAt: at(24 * 14), updatedAt: at(24 * 10), nickname: "Support line", numberType: "national", scope: "Global" },
    { id: newId("num"), userId, number: "+1 (415) 555-0177", provider: "Twilio (BYOT)", agentName: "Outbound SDR", status: "unassigned", createdAt: at(24 * 7), updatedAt: at(24 * 7), nickname: "Outbound campaigns", numberType: "local", scope: "Global" },
  ];

  const webhooks: Webhook[] = [
    {
      id: newId("wbh"),
      userId,
      url: "https://example.com/webhooks/calls",
      events: ["call.started", "call.ended"],
      active: true,
      createdAt: at(24 * 6),
    },
  ];

  const knowledgeBases: KnowledgeBase[] = [
    {
      id: newId("kb"),
      userId,
      name: "Company FAQ",
      description: "Text content",
      docsCount: 12,
      createdAt: at(24 * 12),
      updatedAt: at(24 * 3),
      type: "text",
      content:
        "We are open Monday to Friday 9 AM to 6 PM, and Saturdays until 6 PM. Free parking is available in the lot behind the building on Oak Street. Appointments can be booked, moved, or cancelled by phone at any time. Standard consultations cost $80; follow-up visits are $50. We accept all major insurance plans.",
    },
    {
      id: newId("kb"),
      userId,
      name: "Website — services & pricing",
      description: "Website/URL content",
      docsCount: 1,
      createdAt: at(24 * 9),
      updatedAt: at(24 * 1),
      type: "url",
      url: "https://example.com/services",
      autoUpdate: true,
    },
    {
      id: newId("kb"),
      userId,
      name: "Product catalog (PDF)",
      description: "Uploaded file(s)",
      docsCount: 7,
      createdAt: at(24 * 8),
      updatedAt: at(24 * 8),
      type: "file",
    },
  ];

  return { agents, calls, campaigns, contacts, phoneNumbers, webhooks, knowledgeBases };
}
