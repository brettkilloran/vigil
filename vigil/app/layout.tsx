import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Lora, Noto_Sans_JP } from "next/font/google";

import { RegisterSw } from "@/src/components/RegisterSw";
import { HEARTGARDEN_BRAND_ICON_PATH } from "@/src/lib/brand-mark";
import { HEARTGARDEN_APP_VERSION_LABEL } from "@/src/lib/app-version";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  weight: "700",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

/**
 * Canvas shell: keep browser pinch / smart-zoom from scaling the whole page (Chrome ctrl+wheel,
 * Safari trackpad). In-canvas zoom is handled in `ArchitecturalCanvasApp`.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "heartgarden",
  description: "Infinite canvas TTRPG worldbuilding",
  applicationName: "heartgarden",
  generator: `heartgarden/${HEARTGARDEN_APP_VERSION_LABEL}`,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: HEARTGARDEN_BRAND_ICON_PATH, type: "image/svg+xml" }],
    apple: [{ url: HEARTGARDEN_BRAND_ICON_PATH }],
  },
  openGraph: {
    title: "heartgarden",
    description: "Infinite canvas TTRPG worldbuilding",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${notoSansJP.variable}`}
    >
      <body>
        {children}
        <div id="hg-portal-root" />
        <RegisterSw />
      </body>
    </html>
  );
}
