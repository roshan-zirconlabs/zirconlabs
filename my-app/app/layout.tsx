import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CosmosBackdrop from "@/components/layout/CosmosBackdrop";
import { Analytics } from "@vercel/analytics/next";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

const description = "Turn a chart signal into a guarded, traceable Polymarket trading bot. Built on KeeperHub.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.zirconlabs.org"),
  title: "Zircon Labs",
  applicationName: "Zircon Labs",
  description,
  openGraph: { siteName: "Zircon Labs", title: "Zircon Labs", description, type: "website" },
  twitter: { card: "summary", title: "Zircon Labs", description },
};

export const viewport: Viewport = {
  themeColor: "#05071a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body className="antialiased">
        <Providers>
          <CosmosBackdrop />
          <div className="relative z-10 flex min-h-screen flex-col">
            <Header />
            <div id="main-content" className="flex-1">
              {children}
            </div>
            <Footer />
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
