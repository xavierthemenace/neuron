import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaStatus } from "@/components/PwaStatus";
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
  title: "Neuron — Intelligence Map",
  description:
    "A personal map of trainable intelligence. Log real practice and watch the network light up.",
  applicationName: "Neuron",
  appleWebApp: {
    capable: true,
    title: "Neuron",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/neuron-icon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0f16",
  colorScheme: "dark",
};

// Typed explicitly rather than with the generated `LayoutProps<"/">` global:
// that helper only exists after `next dev`/`next build`/`next typegen` has
// written .next/dev/types, so a clean standalone `tsc --noEmit` (as CI runs
// before the build step) cannot see it. The root route has no dynamic params
// and no parallel-route slots, so this type is exactly what the helper would
// have inferred -- no checking is given up.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <PwaStatus />
      </body>
    </html>
  );
}
