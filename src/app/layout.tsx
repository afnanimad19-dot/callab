import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceLine AI — AI voice agents with live human supervision",
  description:
    "Build AI voice agents that answer, qualify, and schedule on your existing phone lines — with real-time transcripts, sentiment monitoring, and one-click human takeover.",
};

// Applies the saved theme before first paint so there's no flash of the
// wrong theme. Dark is the default; only "light" sets the attribute.
const themeInit = `try{if(localStorage.getItem("theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
