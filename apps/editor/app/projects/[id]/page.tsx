import { Editor } from "../../../components/Editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Editor id={(await params).id} />;
}
