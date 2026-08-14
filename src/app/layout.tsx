import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://reeti.local"),
  title: {
    default: "Reeti — Your way of working, remembered",
    template: "%s · Reeti",
  },
  description:
    "A local-first content operator that carries a creator's decisions into the next campaign.",
  applicationName: "Reeti",
  generator: "Next.js",
  keywords: ["creator workflow", "content repurposing", "persistent AI agent", "Minds"],
  openGraph: {
    type: "website",
    title: "Reeti — Your way of working, remembered",
    description: "Turn one source into an approved campaign with its decisions attached.",
    siteName: "Reeti",
    images: [{ url: "/og-card.svg", width: 1200, height: 630, alt: "Reeti proofroom" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reeti — Your way of working, remembered",
    description: "A persistent content operator for creators.",
    images: ["/og-card.svg"],
  },
  robots: { index: false, follow: false },
  icons: { icon: "/mark.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f4f7fa",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
