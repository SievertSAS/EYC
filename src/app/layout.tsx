import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { NumberWheelGuard } from "@/components/number-wheel-guard";
import "./globals.css";

// Inter servida desde el repo (fuente variable, subset latino, OFL — ver
// fonts/Inter-OFL.txt). Con next/font/google el build descargaba la fuente
// en cada deploy y dos deploys de Vercel fallaron por eso.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-sans",
  weight: "300 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sievert EyC — Estudios y Controles",
  description:
    "Aplicación de captura de datos para control de calidad de equipos de radiación ionizante",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EyC",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#825AF2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <NumberWheelGuard />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
