import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

const corpo = DM_Sans({ subsets: ["latin"], axes: ["opsz"], variable: "--fonte-corpo", display: "swap" });
const titulo = Manrope({ subsets: ["latin"], variable: "--fonte-titulo", display: "swap" });

export const metadata: Metadata = {
  title: "Meu ponto",
  description: "Consulta do saldo de horas a partir do cartão ponto",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f3" },
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const tema = (await cookies()).get("tema")?.value === "escuro" ? "escuro" : "claro";
  return (
    <html lang="pt-BR" data-tema={tema} className={`${corpo.variable} ${titulo.variable}`}>
      {/* Extensões como a ColorZilla alteram atributos do body antes de o React carregar. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
