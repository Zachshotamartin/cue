import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Nav } from "../../../components/Nav";
import { AccountForm } from "../../../components/AccountForm";
export default async function Page({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  if (
    ![
      "sign-in",
      "sign-up",
      "forgot-password",
      "reset-password",
      "verify-email",
    ].includes(mode)
  )
    notFound();
  return (
    <>
      <Nav />
      <Suspense fallback={<p className="page-shell">Loading your account…</p>}>
        <AccountForm mode={mode} />
      </Suspense>
    </>
  );
}
