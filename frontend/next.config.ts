import type { NextConfig } from "next";

// Uploaded media is served from our own domain so platforms that pull files by
// URL (TikTok) see a verified domain; this proxies, it never redirects.
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const mediaBucket = process.env.MEDIA_BUCKET ?? "media";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!supabaseUrl) return [];
    return [
      {
        source: "/media/:path*",
        destination: `${supabaseUrl}/storage/v1/object/public/${mediaBucket}/:path*`,
      },
    ];
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
