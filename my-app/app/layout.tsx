import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "Zircon Labs - Polymarket Trading Bots",
  description:
    "Deterministic automated trading bots on Polymarket powered by KeeperHub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <div id="main-content" className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
