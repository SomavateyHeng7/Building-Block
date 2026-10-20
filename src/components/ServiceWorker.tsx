"use client";

import { useEffect } from "react";

/** Registers the service worker that lets the app open offline. Production only: in development it would cache stale code. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      // The app still works online; it just won't open without a connection.
      console.error(error);
    });
  }, []);
  return null;
}
