import type { Metadata, Viewport } from "next";
import { Syne, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Identidad v2: Syne (wordmark / display / números) + Hanken Grotesk (UI / cuerpo)
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
    <html lang="es" data-cv-theme="vibra" className={`${syne.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  );
}
