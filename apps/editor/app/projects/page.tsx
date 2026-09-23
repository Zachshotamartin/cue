export const dynamic = "force-dynamic";
import { requireUser } from "../../lib/require-user";
import { Nav } from "../../components/Nav";
import { ProjectLibrary } from "../../components/ProjectLibrary";
export default async function Projects() {
  await requireUser();
  return (
    <>
      <Nav />
      <ProjectLibrary />
    </>
  );
}
