import { redirect } from "next/navigation";
import { currentUser } from "./auth-server";
export async function requireUser(next = "/projects") {
  if (!process.env.SUPABASE_URL) redirect("/auth/sign-in");
  const user = await currentUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}
