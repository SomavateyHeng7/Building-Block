import EditorApp from "@/components/editor/EditorApp";

export default async function EditorPage(props: PageProps<"/editor/[diagramId]">) {
  const { diagramId } = await props.params;
  return <EditorApp diagramId={diagramId} />;
}
