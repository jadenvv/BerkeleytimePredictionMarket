import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { ProtocolStatus } from "@/components/ProtocolStatus";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Berkeleytime Markets",
  description:
    "Decentralized prediction markets on Berkeley grade distributions, enrollment and waitlists.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <Suspense fallback={<div className="h-16 border-b border-line" />}>
            <Navbar />
          </Suspense>
          <ProtocolStatus />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line py-6 text-center text-xs text-muted">
            Berkeleytime Markets · Testnet preview · Not affiliated with UC Berkeley
          </footer>
        </Providers>
      </body>
    </html>
  );
}
