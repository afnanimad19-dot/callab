import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions — VoiceLine AI",
  description: "The terms that govern use of VoiceLine AI.",
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

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-ink-400 hover:text-ink-700">← Back to VoiceLine AI</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink-950">Terms &amp; Conditions</h1>
      <p className="mt-2 text-sm text-ink-400">Last updated: {UPDATED}</p>

      <p className="mt-6 text-[15px] leading-relaxed text-ink-700">
        These Terms govern your access to and use of VoiceLine AI (the &ldquo;Service&rdquo;). By creating an account
        or using the Service, you agree to these Terms. If you are using the Service on behalf of a business, you
        confirm you are authorized to bind that business.
      </p>

      <Section title="The service">
        <p>
          VoiceLine provides AI voice and messaging agents, call handling, contacts, calendar, campaigns, and related
          tools that a business uses to communicate with its own customers. We may update or improve features over
          time.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You are responsible for your account, for keeping your login secure, and for all activity under it. You must
          provide accurate information and keep it up to date. You are responsible for the agents you configure and the
          messages and calls they send on your behalf.
        </p>
      </Section>

      <Section title="Acceptable use">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Only contact people who have a lawful basis or consent to be contacted, and honor opt-outs.</li>
          <li>Do not use the Service for spam, fraud, harassment, or unlawful, harmful, or misleading content.</li>
          <li>Do not use it to provide medical, legal, or financial advice that requires a licensed professional,
            beyond general information.</li>
          <li>Comply with all applicable laws and with the policies of connected platforms (for example, Meta and
            Google) and telecom regulations in the regions you operate.</li>
        </ul>
      </Section>

      <Section title="Customer data">
        <p>
          You own the data you and your customers put into the Service. You are the controller of that data and are
          responsible for having the right to process it, including any consent required to record calls or message
          customers. We process it on your behalf as described in our{" "}
          <Link href="/privacy" className="text-[#301C3F] underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section title="Plans, credits &amp; billing">
        <p>
          Paid plans include a monthly allowance of calling credits. Usage is metered from your actual calls; when the
          allowance is used up you can top up to continue. Fees are billed in the currency shown at purchase and,
          unless stated otherwise, are non-refundable except where required by law. Messaging channel fees charged by
          third parties (such as Meta) are separate and may be billed to you or to your own connected account.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>
          The Service connects to third-party providers for voice, messaging, calendar, and hosting. Your use of those
          connections is also subject to the third party&apos;s terms. We are not responsible for third-party services
          we do not control.
        </p>
      </Section>

      <Section title="Availability &amp; disclaimer">
        <p>
          We work to keep the Service reliable but provide it &ldquo;as is&rdquo; without warranties of any kind. We do
          not guarantee uninterrupted or error-free operation, and AI-generated responses may contain mistakes — you
          are responsible for reviewing outcomes that matter.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the extent permitted by law, VoiceLine is not liable for indirect, incidental, or consequential damages,
          and our total liability for any claim is limited to the amount you paid for the Service in the three months
          before the claim.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You may stop using the Service and close your account at any time. We may suspend or terminate access for
          breach of these Terms or misuse. On termination, your right to use the Service ends and your data is handled
          as described in the Privacy Policy.
        </p>
      </Section>

      <Section title="Changes &amp; contact">
        <p>
          We may update these Terms; material changes will be posted here with a new date. Questions? Contact{" "}
          <a className="text-[#301C3F] underline" href="mailto:support@voicelineai.com">support@voicelineai.com</a>.
          These Terms are governed by the laws of the United Arab Emirates.
        </p>
        <p className="text-sm text-ink-400">
          Replace the contact email and company details above with your registered business information before going live.
        </p>
      </Section>
    </main>
  );
}
