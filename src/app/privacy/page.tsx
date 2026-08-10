import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — VoiceLine AI",
  description: "How VoiceLine AI collects, uses, and protects information.",
};

const UPDATED = "August 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink-950">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-ink-400 hover:text-ink-700">← Back to VoiceLine AI</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink-950">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-400">Last updated: {UPDATED}</p>

      <p className="mt-6 text-[15px] leading-relaxed text-ink-700">
        VoiceLine AI (&ldquo;VoiceLine&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides AI voice and messaging
        agents that businesses use to handle calls and conversations with their own customers. This policy explains
        what information we process and how we protect it. It applies to the VoiceLine dashboard and the services it
        connects to.
      </p>

      <Section title="Who controls the data">
        <p>
          Each business that uses VoiceLine (for example, a clinic) is the <strong>controller</strong> of its own
          customer data. VoiceLine acts as a <strong>processor</strong> on that business&apos;s behalf — we process
          data to deliver the service, not for our own purposes. Every business account is isolated; one business
          cannot see another&apos;s data.
        </p>
      </Section>

      <Section title="Information we process">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Account information</strong> — the name, email, company, and password of dashboard users.</li>
          <li><strong>Contacts &amp; conversations</strong> — the names, phone numbers, email addresses, appointments,
            call transcripts, recordings, and chat messages that a business chooses to store or that its agents collect.</li>
          <li><strong>Call &amp; message metadata</strong> — timestamps, durations, direction, and delivery status,
            used for logs, analytics, and billing.</li>
          <li><strong>Connection credentials</strong> — tokens a business provides to connect its own phone number,
            calendar, or messaging channels. These are used only to operate that business&apos;s connections.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>To place and receive calls and messages and to let AI agents respond.</li>
          <li>To store call logs, transcripts, recordings, contacts, and appointments for the business.</li>
          <li>To show analytics and meter usage for billing.</li>
          <li>To operate connected services the business enables (calendar, messaging channels).</li>
        </ul>
        <p>We do not sell personal information, and we do not use a business&apos;s customer data to advertise.</p>
      </Section>

      <Section title="Service providers we use">
        <p>
          To deliver the service we rely on a small number of processors: a voice/telephony processing provider
          (speech-to-text, AI, text-to-speech, and call routing), cloud hosting and database providers, an email
          delivery provider, and — only where a business enables them — Google (Calendar) and Meta
          (WhatsApp, Instagram, Messenger). These providers process data solely to perform their function, under
          their own terms and security controls.
        </p>
      </Section>

      <Section title="Messaging channels (WhatsApp, Instagram, Messenger)">
        <p>
          When a business connects a messaging channel, messages between that business and its customers pass through
          Meta&apos;s platform and are delivered to the business&apos;s VoiceLine inbox so its agent can reply. We
          process these messages only to route, display, and respond to them. Use of these channels is also subject to
          Meta&apos;s own policies.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          We keep data for as long as the business&apos;s account is active or as needed to provide the service. A
          business can delete its contacts, calls, and campaigns from the dashboard at any time. When an account is
          closed, its data is deleted or anonymized within a reasonable period, unless we must retain it to meet a
          legal obligation.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Access is protected by authentication and per-account isolation, and traffic is encrypted in transit.
          Provider credentials are used to operate connections and are handled with care. No system is perfectly
          secure, but we work to protect information against unauthorized access, loss, or misuse.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct, export, or delete your personal
          information. If you are a customer of a business that uses VoiceLine, please contact that business first, as
          it controls your data. You can also contact us and we will help route your request.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For privacy questions, contact us at <a className="text-[#301C3F] underline" href="mailto:support@voicelineai.com">support@voicelineai.com</a>.
          This policy is governed by the laws of the United Arab Emirates.
        </p>
        <p className="text-sm text-ink-400">
          Replace the contact email and company details above with your registered business information before going live.
        </p>
      </Section>
    </main>
  );
}
