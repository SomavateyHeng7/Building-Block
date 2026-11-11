import type { Metadata } from "next";

// The page is a client component, which can't export metadata, so its title is set here.
export const metadata: Metadata = {
  title: "Start · Building Block",
  description: "Start a new architecture diagram, open one from your device, or begin from a template.",
};

export default function DiagramsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
