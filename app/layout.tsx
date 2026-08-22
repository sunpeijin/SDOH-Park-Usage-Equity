import type { Metadata, Viewport } from "next";
import "./globals.css";

const GITHUB_PAGES_BASE_PATH = "/SDOH-Park-Usage-Equity";
const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";
const publicBasePath = isGitHubPagesBuild ? GITHUB_PAGES_BASE_PATH : "";
const metadataBase = new URL(
  isGitHubPagesBuild
    ? "https://sunpeijin.github.io/SDOH-Park-Usage-Equity/"
    : "http://localhost:3000/",
);
const title = "Social Equity in Park Facilities Under Public Health Disruption";
const description = "Explore aggregated Austin park use and fully adjusted facility-equity evidence during public-health disruption.";
const socialDescription = "Explore how park use and facility associations varied across Austin during public-health disruption.";
const socialImage = new URL("og.png", metadataBase).toString();

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  icons: {
    icon: `${publicBasePath}/favicon.svg`,
    shortcut: `${publicBasePath}/favicon.svg`,
  },
  openGraph: {
    title,
    description: socialDescription,
    type: "website",
    images: [{ url: socialImage, width: 1680, height: 946, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: socialDescription,
    images: [socialImage],
  },
};

export const dynamic = "force-static";

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
