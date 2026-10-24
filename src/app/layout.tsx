import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: armá un plan y sumá gente`, template: `%s | ${APP_NAME}` },
  description: "Publicás un plan, compartís el link o el QR y se suma gente con ganas de lo mismo.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${montserrat.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
