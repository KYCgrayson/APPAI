import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIGA - AI App Hosting Platform",
  description:
    "Host your AI-built App's landing page, privacy policy, and terms of service. Free. Powered by AI Agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased font-sans"
      >
        {children}
      </body>
    </html>
  );
}
