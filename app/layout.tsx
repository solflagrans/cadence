import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadence — персональное планирование",
  description: "Месяц, неделя и фактические результаты в одной спокойной системе.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
