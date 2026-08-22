import type { NextConfig } from "next";

const GITHUB_PAGES_BASE_PATH = "/SDOH-Park-Usage-Equity";
const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPagesBuild ? GITHUB_PAGES_BASE_PATH : "";

const nextConfig: NextConfig = {
  ...(isGitHubPagesBuild
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // vinext's exporter renders routes without the configured basePath. This
  // identity rewrite lets that build-only request reach the static route while
  // generated browser URLs continue to use the repository basePath.
  async rewrites() {
    if (!isGitHubPagesBuild) return [];

    return [
      {
        source: "/",
        destination: "/",
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
