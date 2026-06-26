import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond, DM_Mono } from "next/font/google";
import { headers } from "next/headers";
import "@/app/globals.css";
import { QueryProvider } from "@/shared/components/QueryProvider";
import { ToastProvider } from "@/shared/components/ui";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["500", "600", "700"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "LeAd — Legal Advisor", template: "%s — LeAd" },
  description: "AI-powered legal advisor for every Indian. Find a lawyer, track your case, get expert guidance.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="en" className={`h-full ${dmSans.variable} ${cormorantGaramond.variable} ${dmMono.variable}`}>
      <body className="min-h-full font-sans antialiased bg-base-100 text-brand-blue-dark">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}

function Providers({ children, nonce }: { children: React.ReactNode; nonce: string }) {
  return (
    <QueryProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryProvider>
  );
}