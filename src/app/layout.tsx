import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";

export const metadata: Metadata = {
  title: "Build for India - Multi-Agent AI System",
  description:
    "Intelligent multi-agent system for autonomous decision-making and collaboration",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <TranscriptProvider>
          <EventProvider>{children}</EventProvider>
        </TranscriptProvider>
      </body>
    </html>
  );
}
