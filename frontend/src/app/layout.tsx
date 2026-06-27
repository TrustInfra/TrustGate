import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Space_Mono, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
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

const SITE_URL = "https://www.trustgated.xyz";
const SITE_NAME = "TrustGate";
const SITE_DESCRIPTION =
  "TrustGate scores wallets and tokens on-chain using behavioral signals (bot detection, deployment history, transaction patterns) and gates access to payments and services. Built on Arc.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "TrustGate | Trust Layer for Web3",
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.png", sizes: "32x32", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "TrustGate | Trust Layer for Web3",
    description: SITE_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: "/og-image.png?v=2",
        width: 1200,
        height: 630,
        alt: "TrustGate, the trust layer for Web3",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TrustGate | Trust Layer for Web3",
    description: SITE_DESCRIPTION,
    images: ["/og-image.png?v=2"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.png`,
      },
      sameAs: [
        "https://x.com/TrustGated",
        "https://discord.gg/kbx9RAGCmx",
        "https://github.com/rudazy",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    },
  ],
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={spaceMono.className}>
        <Web3Provider>
          <div className="flex flex-col min-h-screen relative">
            <BackgroundPaths />
            <Navbar />
            <main className="flex-1 relative z-10">{children}</main>
            <Footer />
          </div>
        </Web3Provider>
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="9637b3a5-153e-404c-8d78-e850d08b1fae"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
