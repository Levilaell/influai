import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { MetaPixel } from "@/components/meta-pixel";
import { Toaster } from "@/components/toast";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
  style: ["normal", "italic"],
});
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "influai. — fábrica de influenciadores de IA",
  description: "Crie um influenciador de IA que posta sozinho, todos os dias.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${fraunces.variable} ${grotesk.variable} min-h-screen`}>
        <MetaPixel />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
