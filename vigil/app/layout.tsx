import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono, Lora, Noto_Sans_JP, Space_Mono } from "next/font/google";

import { RegisterSw } from "@/src/components/RegisterSw";
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
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  weight: "700",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

/** Boot / preload screen (VigilAppBootScreen): frontloaded with layout for first paint. */
const vigilBootDisplay = Cormorant_Garamond({
  variable: "--font-vigil-boot-display",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["300", "400"],
});

const vigilBootMono = Space_Mono({
  variable: "--font-vigil-boot-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "heartgarden",
  description: "Infinite canvas TTRPG worldbuilding",
  applicationName: "heartgarden",
  manifest: "/manifest.webmanifest",
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
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${notoSansJP.variable} ${vigilBootDisplay.variable} ${vigilBootMono.variable}`}
    >
      <body>
        {children}
        <RegisterSw />
      </body>
    </html>
  );
}
