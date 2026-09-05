import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";
import { GuestBanner } from "@/components/guest-banner";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { default: "Koto — Japanese foundations", template: "%s · Koto" },
  description: "Learn Japanese sound, rhythm, pitch accent and kana with a cumulative FSRS trainer built for English speakers.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Koto — Japanese foundations",
    description: "Hear the beat. Build kana memories that last.",
    images: [{ url: "/og-koto.png", width: 1792, height: 896, alt: "A Japanese あ study card with pitch and timing marks" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-koto.png"] },
};

export const viewport: Viewport = { themeColor: "#f6f1e8", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers><SiteHeader /><GuestBanner />{children}<SiteFooter /></Providers>
      </body>
    </html>
  );
}
