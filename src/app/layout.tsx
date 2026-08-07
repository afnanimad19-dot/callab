import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceLine AI — AI voice agents with live human supervision",
  description:
    "Build AI voice agents that answer, qualify, and schedule on your existing phone lines — with real-time transcripts, sentiment monitoring, and one-click human takeover.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
