import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Geist_Mono, Instrument_Serif } from "next/font/google";
import { PwaStatus } from "@/components/PwaStatus";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

// Used only for headlines and the figures that carry a screen. Loading one
// weight keeps a display face from costing what a whole family would.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Neuron",
  description:
    "A personal map of trainable intelligence. Log real practice and watch the network light up.",
  applicationName: "Neuron",
  appleWebApp: {
    capable: true,
    title: "Neuron",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/neuron-icon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#efece6",
  colorScheme: "light",
  // Without this, env(safe-area-inset-*) resolves to zero on iOS and the
  // bottom bar sits under the home indicator in the installed app. The CSS
  // that reads those variables has been there since the bar was built.
  viewportFit: "cover",
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
      className={`${dmSans.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <PwaStatus />
      </body>
    </html>
  );
}
