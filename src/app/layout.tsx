import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Broadcast — Your AI CMO",
  description:
    "Connect a project and put an AI Chief Marketing Officer to work: live SEO audits, content generation, and autonomous posting agents for X, Reddit, Hacker News, LinkedIn, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
