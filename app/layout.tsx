import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AtomQuest Goal Portal | Atomberg Technologies",
  description:
    "In-house goal setting and tracking portal for Atomberg Technologies. Set goals, track progress, and drive performance across the organization.",
  keywords: ["goals", "tracking", "performance", "atomberg", "OKR"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={3500}
          toastOptions={{
            style: {
              background: "oklch(0.19 0.02 270)",
              border: "1px solid oklch(0.28 0.025 270)",
              color: "oklch(0.95 0.005 270)",
            },
          }}
        />
      </body>
    </html>
  );
}
