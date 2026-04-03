import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";

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

export const metadata: Metadata = {
  title: "VIGIL",
  description: "Infinite canvas TTRPG worldbuilding",
  applicationName: "VIGIL",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "VIGIL",
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
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable}`}
    >
      <body>
        {children}
        <RegisterSw />
      </body>
    </html>
  );
}
