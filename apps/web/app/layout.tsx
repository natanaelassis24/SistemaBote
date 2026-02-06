import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SistemaBote",
  description: "Create a WhatsApp bot in minutes"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
