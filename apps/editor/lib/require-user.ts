import { redirect } from "next/navigation";
import { getAuth } from "./auth-server";
export async function requireUser(next = "/projects") {
  if (!process.env.NEON_AUTH_BASE_URL) redirect("/auth/sign-in");
  const { data, error } = await getAuth().getSession();
  if (error || !data?.user)
    redirect(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  return data.user;
}
