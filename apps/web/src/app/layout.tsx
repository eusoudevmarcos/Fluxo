import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "@fontsource/comfortaa/400.css";
import "@fontsource/comfortaa/500.css";
import "@fontsource/comfortaa/600.css";
import "@fontsource/comfortaa/700.css";
import "@fontsource/quicksand/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluxo",
  description: "Rede social brasileira para Flow, Vibes, salas e comunidades em tempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="theme-sunflow">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
