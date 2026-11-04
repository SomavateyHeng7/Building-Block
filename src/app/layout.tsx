import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { NONCE_HEADER } from "@/lib/csp";
import { ThemeProvider } from "@/components/theme-provider";
import ToastViewport from "@/components/ToastViewport";
import ConsentGate from "@/components/ConsentGate";
import ServiceWorker from "@/components/ServiceWorker";
import Analytics from "@/components/Analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Building Block",
  description: "Architecture diagrams for solution architects.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under notches and rounded corners; the app pads itself with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Reading the request's nonce renders every page per request: a page built ahead of time would carry no nonce,
// and the Content-Security-Policy would block its scripts (see src/lib/csp.ts).
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            nonce={nonce}
          >
          {children}
          <ToastViewport />
          <ConsentGate />
          <ServiceWorker />
          <Analytics />
          </ThemeProvider>
        </body>
    </html>
  );
}
