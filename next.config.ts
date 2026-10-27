import type { NextConfig } from "next";

// These are compiled into the build, so a release that forgets them ships without a way to reach us (see .env.example).
if (process.env.NODE_ENV === "production") {
  const unset = ["NEXT_PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_WAITLIST_URL", "NEXT_PUBLIC_CF_ANALYTICS_TOKEN"].filter(
    (name) => !process.env[name],
  );
  if (unset.length) console.warn(`[building-block] Not set for this build: ${unset.join(", ")}. See .env.example.`);
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The editor shouldn't be framed by other sites (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // The service worker must always be fetched fresh, or a release would never reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
