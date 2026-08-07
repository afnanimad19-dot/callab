import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceLine AI — AI voice agents with live human supervision",
  description:
    "Build AI voice agents that answer, qualify, and schedule on your existing phone lines — with real-time transcripts, sentiment monitoring, and one-click human takeover.",
  icons: { icon: "/media/logo.webp" },
  openGraph: {
    title: "VoiceLine AI — AI voice agents with live human supervision",
    description:
      "Voice agents that answer, schedule and qualify on your existing lines — while your team watches every word live.",
    images: ["/media/og.png"],
  },
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
