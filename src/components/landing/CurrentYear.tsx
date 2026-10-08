"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * The visitor's current year. The page is prerendered at build time, so a server-rendered
 * year would go stale until the next deploy; the client snapshot keeps it correct.
 */
export default function CurrentYear() {
  const year = useSyncExternalStore(
    noopSubscribe,
    () => new Date().getFullYear(),
    () => new Date().getFullYear(),
  );
  return <span suppressHydrationWarning>{year}</span>;
}
