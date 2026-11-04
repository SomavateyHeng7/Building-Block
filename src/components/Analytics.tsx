"use client";

import { useEffect } from "react";

/** The site's Cloudflare Web Analytics token, set at build time. Without it nothing is loaded. */
const TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;

/** True when the browser asks sites not to track it (Global Privacy Control or Do Not Track). */
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/**
 * Counts visits with Cloudflare Web Analytics: cookieless, no personal data kept, no diagram content (only the page
 * address). The numbers are on the Cloudflare dashboard. `spa` counts moves between pages inside the app too.
 * Skipped for browsers that opt out, and offline the beacon just fails quietly.
 */
export default function Analytics() {
  useEffect(() => {
    if (!TOKEN || process.env.NODE_ENV !== "production" || optedOut()) return;
    if (document.querySelector("script[data-cf-beacon]")) return;
    const script = document.createElement("script");
    script.defer = true;
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    script.dataset.cfBeacon = JSON.stringify({ token: TOKEN, spa: true });
    document.head.appendChild(script);
  }, []);
  return null;
}
