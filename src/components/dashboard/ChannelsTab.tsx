"use client";

// Settings → Channels: connect WhatsApp / Instagram / Messenger (each
// customer's own Meta app credentials) and configure the Agent Hub — the
// default chat agent that answers incoming messages, with a master on/off
// toggle. Webhook details for the Meta app are shown at the bottom.

import { useEffect, useState } from "react";
import { MessageCircle, Camera, MessagesSquare, Bot, Save } from "lucide-react";
import type { Agent } from "@/lib/db";
import { toast, toastError } from "@/components/Toast";

interface ChannelForm {
  id: string; // phoneNumberId or pageId
  accessToken: string;
  connected: boolean;
}

export default function ChannelsTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [defaultAgentId, setDefaultAgentId] = useState("");
  const [aiAutoReply, setAiAutoReply] = useState(true);
  const [whatsapp, setWhatsapp] = useState<ChannelForm>({ id: "", accessToken: "", connected: false });
  const [instagram, setInstagram] = useState<ChannelForm>({ id: "", accessToken: "", connected: false });
  const [messenger, setMessenger] = useState<ChannelForm>({ id: "", accessToken: "", connected: false });
  const [verifyToken, setVerifyToken] = useState<"set" | "missing">("missing");
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? [])).catch(() => {});
    fetch("/api/channels").then((r) => r.json()).then((d) => {
      const s = d.settings;
      if (!s) return;
      setDefaultAgentId(s.defaultChatAgentId ?? "");
      setAiAutoReply(Boolean(s.aiAutoReply));
      if (s.whatsapp) setWhatsapp({ id: s.whatsapp.phoneNumberId, accessToken: s.whatsapp.accessToken, connected: s.whatsapp.connected });
      if (s.instagram) setInstagram({ id: s.instagram.pageId, accessToken: s.instagram.accessToken, connected: s.instagram.connected });
      if (s.messenger) setMessenger({ id: s.messenger.pageId, accessToken: s.messenger.accessToken, connected: s.messenger.connected });
      setVerifyToken(s.verifyToken ?? "missing");
    }).catch(() => {});
  }, []);

  async function save() {
    setBusy(true);
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultChatAgentId: defaultAgentId,
        aiAutoReply,
        whatsapp: whatsapp.id && whatsapp.accessToken ? { phoneNumberId: whatsapp.id, accessToken: whatsapp.accessToken } : undefined,
        instagram: instagram.id && instagram.accessToken ? { pageId: instagram.id, accessToken: instagram.accessToken } : undefined,
        messenger: messenger.id && messenger.accessToken ? { pageId: messenger.id, accessToken: messenger.accessToken } : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      toast("Channel settings saved.");
      if (data.connected) {
        setWhatsapp((w) => ({ ...w, connected: data.connected.whatsapp }));
        setInstagram((i) => ({ ...i, connected: data.connected.instagram }));
        setMessenger((m) => ({ ...m, connected: data.connected.messenger }));
      }
    } else {
      toastError(data.error ?? "Could not save the channel settings.");
    }
  }

  function ChannelCard({
    title, icon, idLabel, idPlaceholder, form, setForm, note,
  }: {
    title: string;
    icon: React.ReactNode;
    idLabel: string;
    idPlaceholder: string;
    form: ChannelForm;
    setForm: (f: ChannelForm) => void;
    note: string;
  }) {
    return (
      <div className="card">
        <div className="flex items-start justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">{icon} {title}</h3>
          <span className={form.connected ? "badge-ok" : "badge-muted"}>
            {form.connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{idLabel}</label>
            <input className="field font-mono !text-[13px]" placeholder={idPlaceholder}
              value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.trim() })} />
          </div>
          <div>
            <label className="label">Access Token</label>
            <input type="password" className="field font-mono !text-[13px]" placeholder="EAAG…"
              value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value.trim() })} />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-400">{note}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Agent Hub */}
      <div className="card">
        <h3 className="flex items-center gap-2 text-base font-semibold"><Bot className="h-4 w-4 text-ink-400" /> Agent Hub</h3>
        <p className="mt-1 text-sm text-ink-400">
          The default AI agent that answers incoming chats on every connected channel. You can
          override the agent per conversation inside the Inbox, or take over as a human anytime.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[260px]">
            <label className="label">Default chat agent</label>
            <select className="field" value={defaultAgentId} onChange={(e) => setDefaultAgentId(e.target.value)}>
              <option value="">Select an agent</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-700 px-4 py-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={aiAutoReply}
              onClick={() => setAiAutoReply((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition ${aiAutoReply ? "bg-[#301C3F]" : "bg-ink-700"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${aiAutoReply ? "left-[18px]" : "left-0.5"}`} />
            </button>
            <span className="text-sm font-medium">AI auto-reply {aiAutoReply ? "on" : "off"}</span>
          </label>
        </div>
      </div>

      <ChannelCard
        title="WhatsApp"
        icon={<MessageCircle className="h-4 w-4 text-emerald-600" />}
        idLabel="Phone Number ID"
        idPlaceholder="1042…"
        form={whatsapp}
        setForm={setWhatsapp}
        note="From Meta for Developers → your app → WhatsApp → API Setup. Use a permanent System User token with whatsapp_business_messaging permission."
      />
      <ChannelCard
        title="Instagram DM"
        icon={<Camera className="h-4 w-4 text-pink-600" />}
        idLabel="Instagram Page ID"
        idPlaceholder="1784…"
        form={instagram}
        setForm={setInstagram}
        note="The professional Instagram account must be linked to a Facebook Page; use a page token with instagram_manage_messages."
      />
      <ChannelCard
        title="Facebook Messenger"
        icon={<MessagesSquare className="h-4 w-4 text-blue-600" />}
        idLabel="Facebook Page ID"
        idPlaceholder="1094…"
        form={messenger}
        setForm={setMessenger}
        note="Use a page access token with pages_messaging permission from the same Meta app."
      />

      {/* Webhook info */}
      <div className="card">
        <h3 className="text-base font-semibold">Meta webhook</h3>
        <p className="mt-1 text-sm text-ink-400">
          In your Meta app, subscribe WhatsApp / Messenger / Instagram webhooks to this callback URL:
        </p>
        <p className="mt-2 rounded-lg bg-ink-800 px-3 py-2 font-mono text-xs text-ink-200">
          {origin}/api/channels/webhook
        </p>
        <p className="mt-2 text-xs text-ink-400">
          Verify token: the value of <code className="rounded bg-ink-800 px-1">META_VERIFY_TOKEN</code> in your
          environment variables — currently <span className={verifyToken === "set" ? "font-semibold text-emerald-600" : "font-semibold text-signal-red"}>{verifyToken}</span>.
          Subscribe to the <code className="rounded bg-ink-800 px-1">messages</code> field.
        </p>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={busy} className="btn-primary flex items-center gap-1.5 disabled:opacity-60">
          <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Channel Settings"}
        </button>
      </div>
    </div>
  );
}
