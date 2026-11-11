import type { Metadata } from "next";

// The page is a client component, which can't export metadata, so its title is set here.
export const metadata: Metadata = {
  title: "Templates · Building Block",
  description: "Architecture, flowchart, sequence and process templates to start a diagram from.",
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
