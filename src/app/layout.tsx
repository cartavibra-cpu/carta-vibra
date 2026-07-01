import type { Metadata, Viewport } from "next";
import { Syne, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import ThemeSync from "@/components/ThemeSync";

// Aplica la paleta global guardada ANTES de pintar (sin flash). Si no hay, queda Vibra.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('cv-theme');if(t&&['vibra','cyan','fiesta','cobre','ambar','vino','tinta','niebla','salvia','lino','crema','algodon'].indexOf(t)>-1){document.documentElement.dataset.cvTheme=t;}}catch(e){}})();`;

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
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
