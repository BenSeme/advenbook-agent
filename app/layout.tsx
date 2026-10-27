import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdvenBook Agent — your Strava, as a book",
  description:
    "Tell the agent what book you want. It picks your Strava outings, asks a few questions, and drafts your AdvenBook.",
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
