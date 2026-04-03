import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Lora } from "next/font/google";

import { RegisterSw } from "@/src/components/RegisterSw";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
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
      className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {children}
        <RegisterSw />
      </body>
    </html>
  );
}
