import type { NextConfig } from "next";

// The UploadThing token is base64 JSON that includes the app id.
function uploadThingAppId(): string | undefined {
  try {
    const token = process.env.UPLOADTHING_TOKEN;
    return token ? (JSON.parse(Buffer.from(token, "base64").toString()) as { appId?: string }).appId : undefined;
  } catch {
    return undefined;
  }
}
const appId = uploadThingAppId();

const nextConfig: NextConfig = {
  // Uploads are served from our own domain so platforms that pull files by URL
  // (TikTok) see a verified domain. A rewrite proxies; it never redirects.
  async rewrites() {
    if (!appId) return [];
    return [{ source: "/media/:id", destination: `https://${appId}.ufs.sh/f/:id` }];
  },
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // Without this condition the rule also catches *.module.css, which
        // then compiles as global CSS and its class names come back empty.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
