import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Syne, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

// Identidad v2: Syne (wordmark/display) + Hanken Grotesk (UI)
const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Carta Vibra",
  description: "Tu rockola DJ digital · la vibra se elige entre todos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-cv-theme="vibra" className={`${inter.variable} ${spaceGrotesk.variable} ${syne.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
