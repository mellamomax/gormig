import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stockrobber Agent",
  description: "Private manual-first TikTok investment analysis dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
