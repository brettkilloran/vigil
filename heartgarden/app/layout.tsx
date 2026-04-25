import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Lora,
  Noto_Sans_JP,
  Playfair_Display,
} from "next/font/google";

import { RegisterSw } from "@/src/components/RegisterSw";
import { HEARTGARDEN_APP_VERSION_LABEL } from "@/src/lib/app-version";
import { HEARTGARDEN_BRAND_ICON_PATH } from "@/src/lib/brand-mark";
import "./globals.css";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const lora = Lora({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-lora",
});

/** Lore character ID plate (v11) — Inter + Playfair for caps / display contrast. */
const hgIdInter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-hg-id-inter",
  weight: ["400", "500", "600"],
});

const hgIdPlayfair = Playfair_Display({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-hg-id-playfair",
  weight: ["400", "500", "600", "700"],
});

const notoSansJP = Noto_Sans_JP({
  display: "swap",
  preload: true,
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  weight: "700",
});

/**
 * Canvas shell: keep browser pinch / smart-zoom from scaling the whole page (Chrome ctrl+wheel,
 * Safari trackpad). In-canvas zoom is handled in `ArchitecturalCanvasApp`.
 */
export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  width: "device-width",
};

export const metadata: Metadata = {
  applicationName: "heartgarden",
  description: "Infinite canvas TTRPG worldbuilding",
  generator: `heartgarden/${HEARTGARDEN_APP_VERSION_LABEL}`,
  icons: {
    apple: [{ url: HEARTGARDEN_BRAND_ICON_PATH }],
    icon: [{ type: "image/svg+xml", url: HEARTGARDEN_BRAND_ICON_PATH }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    description: "Infinite canvas TTRPG worldbuilding",
    title: "heartgarden",
  },
  title: "heartgarden",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${notoSansJP.variable} ${hgIdInter.variable} ${hgIdPlayfair.variable}`}
      lang="en"
    >
      <body>
        {children}
        <div id="hg-portal-root" />
        <RegisterSw />
      </body>
    </html>
  );
}
