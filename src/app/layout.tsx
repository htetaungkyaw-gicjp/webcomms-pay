import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "sonner";

/**
 * Fonts (DESIGN.md typography): body/UI is Roboto. Headlines call for "Google
 * Sans", which is not distributed via Google Fonts — DESIGN.md's documented
 * fallback chain is Product Sans → Roboto, so we map --font-google-sans to
 * Roboto here (globals.css --font-display resolves through it). Swap in the real
 * Google Sans face via a self-hosted @font-face if/when licensed.
 */
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "WebComms & Pay",
  description:
    "Parent communication and payments for schools, gyms, and clubs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-on-surface">
        <QueryProvider>{children}</QueryProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
