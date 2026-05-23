import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@multica/ui/components/ui/sonner";
import { cn } from "@multica/ui/lib/utils";
import { WebProviders } from "@/components/web-providers";
import { LocaleSync } from "@/components/locale-sync";
import "./globals.css";

// Font stack: Inter for Latin UI text + system Chinese fonts for zh content.
// Desktop app uses the same stack via apps/desktop/src/renderer/src/globals.css —
// keep the CJK fallback tail in sync across both files. The Inter primary family
// differs by design: next/font produces `__Inter_xxx` (with a synthetic size-adjusted
// fallback face to prevent FOUT layout shift); desktop uses fontsource's "Inter Variable".
// Both resolve to Inter glyphs, so rendering is identical in practice.
// Currently covers English + Simplified Chinese. When ja/ko i18n lands, extend
// the tail with Hiragino Kaku Gothic ProN / Yu Gothic / Apple SD Gothic Neo / Malgun Gothic.
// Per-character fallback: Latin chars render with Inter, Chinese chars with
// PingFang SC (macOS) / Microsoft YaHei (Windows) / Noto Sans CJK SC (Linux).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "PingFang SC",
    "Microsoft YaHei",
    "Noto Sans CJK SC",
    "sans-serif",
  ],
});
// Mono font has no explicit CJK fallback: CJK chars in code blocks are inherently
// non-aligned with a mono grid (Chinese is proportional), so listing CJK fonts
// here would falsely signal alignment guarantees. Browser default fallback handles
// the rare mixed case correctly.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});
// Editorial serif used for onboarding headlines. Italic support for h1 em
// accents (e.g. "...on one shared board."). Only loaded on routes that
// render the font; layout-shift-prevention handled by next/font's synthetic
// fallback metrics, same as Inter.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  fallback: [
    "ui-serif",
    "Iowan Old Style",
    "Apple Garamond",
    "Baskerville",
    "Times New Roman",
    "serif",
  ],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#05070b" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://agenthost.pro"),
  title: {
    default: "Kensink Labs — AI Agent Task Management",
    template: "%s | Kensink Labs",
  },
  description:
    "Kensink Labs — AI-native task management platform. Assign tasks to agents, track progress, compound skills.",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon/android-icon-192x192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon/favicon.ico",
    apple: [
      { url: "/favicon/apple-icon-57x57.png", sizes: "57x57" },
      { url: "/favicon/apple-icon-60x60.png", sizes: "60x60" },
      { url: "/favicon/apple-icon-72x72.png", sizes: "72x72" },
      { url: "/favicon/apple-icon-76x76.png", sizes: "76x76" },
      { url: "/favicon/apple-icon-114x114.png", sizes: "114x114" },
      { url: "/favicon/apple-icon-120x120.png", sizes: "120x120" },
      { url: "/favicon/apple-icon-144x144.png", sizes: "144x144" },
      { url: "/favicon/apple-icon-152x152.png", sizes: "152x152" },
      { url: "/favicon/apple-icon-180x180.png", sizes: "180x180" },
    ],
  },
  manifest: "/favicon/manifest.json",
  other: {
    "msapplication-config": "/favicon/browserconfig.xml",
    "msapplication-TileColor": "#ffffff",
    "msapplication-TileImage": "/favicon/ms-icon-144x144.png",
  },
  openGraph: {
    type: "website",
    siteName: "Kensink Labs",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased font-sans h-full", inter.variable, geistMono.variable, sourceSerif.variable)}
    >
      <body className="h-full overflow-hidden">
        <LocaleSync />
        <ThemeProvider>
          <WebProviders>
            {children}
          </WebProviders>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
