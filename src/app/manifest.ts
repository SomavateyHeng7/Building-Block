import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Building Block",
    short_name: "Building Block",
    description: "Architecture diagrams for solution architects. Works offline; your diagrams stay in files on your device.",
    start_url: "/diagrams",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#176B4D",
    categories: ["productivity", "business", "developer"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Installed in Chrome or Edge, double-clicking a diagram file opens it here (see the start page).
    file_handlers: [{ action: "/diagrams", accept: { "application/json": [".json"] } }],
    // A fresh window per file, so opening one never replaces a diagram that's being edited.
    launch_handler: { client_mode: "navigate-new" },
  };
}
