import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";

export const metadata: Metadata = {
  title: "Kerala e-District Portal — Certificate Services",
  description:
    "Apply for government certificates online with voice assistance. Caste, Income, Domicile, Birth, Death, and Marriage certificates from the Kerala State Government.",
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
