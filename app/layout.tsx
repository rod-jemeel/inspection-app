import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Summit Inspection Tracker",
    template: "%s | Summit",
  },
  description: "Multi-location inspection checklists with signature capture for Summit teams.",
};

export const viewport: Viewport = {
  themeColor: "#5f97cf",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster richColors closeButton position="bottom-right" toastOptions={{ className: "text-xs" }} />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
