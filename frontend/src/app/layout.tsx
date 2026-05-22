import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Space_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { BackgroundPaths } from "@/components/ui/BackgroundPaths";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrustGate | Trust Layer for Web3",
  description:
    "TrustGate scores wallets and tokens on-chain using behavioral signals -- bot detection, deployment history, transaction patterns -- and gates access to payments and services. Built on Arc.",
  icons: {
    icon: [
    { url: "/favicon.png", sizes: "32x32", type: "image/png" },
  ],
  apple: "/apple-touch-icon.png",
},
  openGraph: {
    title: "TrustGate | Trust Layer for Web3",
    description:
      "TrustGate scores wallets and tokens on-chain using behavioral signals -- bot detection, deployment history, transaction patterns -- and gates access to payments and services. Built on Arc.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${spaceMono.variable} ${jetbrains.variable}`}
    >
      <body className={spaceMono.className}>
        <Web3Provider>
          <div className="flex flex-col min-h-screen relative">
            <BackgroundPaths />
            <Navbar />
            <main className="flex-1 relative z-10">{children}</main>
            <Footer />
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
