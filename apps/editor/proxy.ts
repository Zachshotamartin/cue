import { NextRequest, NextResponse } from "next/server";
import { origin, sessionSecret } from "../../packages/storage/config";
export function proxy(req: NextRequest) {
  if (req.headers.get("host") !== new URL(origin).host)
    return new NextResponse("Cue is a private local installation.", {
      status: 403,
    });
  const response = NextResponse.next();
  if (
    !req.nextUrl.pathname.startsWith("/api/") &&
    req.method === "GET" &&
    req.headers.get("sec-fetch-dest") === "document"
  )
    response.cookies.set("cue_session", sessionSecret, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: origin.startsWith("https:"),
      maxAge: 86400 * 30,
    });
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
