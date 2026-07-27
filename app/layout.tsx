import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import "../src/shared/styles/ui-v2.css";

export const metadata: Metadata = {
  title: "Cadence — персональное планирование",
  description: "Месяц, неделя и фактические результаты в одной спокойной системе.",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
