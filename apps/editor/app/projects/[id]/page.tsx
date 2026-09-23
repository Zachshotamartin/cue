export const dynamic = "force-dynamic";
import { requireUser } from "../../../lib/require-user";
import { Editor } from "../../../components/Editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser(`/projects/${(await params).id}`);
  return <Editor id={(await params).id} />;
}
