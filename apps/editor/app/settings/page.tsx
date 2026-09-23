export const dynamic = "force-dynamic";
import { requireUser } from "../../lib/require-user";
import { Nav } from "../../components/Nav";
import { Settings } from "../../components/Settings";
export default async function Page() {
  await requireUser();
  return (
    <>
      <Nav />
      <Settings />
    </>
  );
}
