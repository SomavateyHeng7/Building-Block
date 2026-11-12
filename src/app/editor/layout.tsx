import type { Metadata } from "next";
import { EDITOR_TITLE } from "@/lib/editor/editorTitle";

// The title shown until a diagram is open; then the editor shows the diagram's name (see editorTitle.ts).
export const metadata: Metadata = {
  title: EDITOR_TITLE,
  description: "Edit your architecture diagram. It stays in a file on your device.",
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
