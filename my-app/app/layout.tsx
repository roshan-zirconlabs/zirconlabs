import type { Metadata } from "next";
import { Sora, Work_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AmbientGalaxy from "@/components/layout/AmbientGalaxy";
import { Analytics } from "@vercel/analytics/next"

const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-sora", display: "swap" });
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-work-sans", display: "swap" });

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
    <html lang="en" className={`${sora.variable} ${workSans.variable}`}>
      <body className="antialiased">
        <Providers>
          <AmbientGalaxy />
          <div className="relative z-10 flex min-h-screen flex-col">
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
