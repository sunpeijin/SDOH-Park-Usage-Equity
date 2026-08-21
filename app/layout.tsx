import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const title = "Social Equity in Park Facilities Under Public Health Disruption";
  const description = "Explore aggregated Austin park use and fully adjusted facility-equity evidence during public-health disruption.";
  return {
    metadataBase: base,
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title,
      description: "Explore how park use and facility associations varied across Austin during public-health disruption.",
      type: "website",
      images: [{ url: new URL("/og.png", base).toString(), width: 1680, height: 946, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: "Explore how park use and facility associations varied across Austin during public-health disruption.",
      images: [new URL("/og.png", base).toString()],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06243a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
