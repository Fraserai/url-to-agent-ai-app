import type { ReactNode } from "react";
import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "AgentDrop",
  description:
    "Paste your website URL and AgentDrop builds a custom website agent for your business in minutes."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-[var(--font-dm-sans)]">{children}</body>
    </html>
  );
}
