import { NextResponse } from "next/server";
// Authentication is verified in every API handler and protected server page.
// Never mint an account session merely because somebody visited a URL.
export function proxy() {
  return NextResponse.next();
}
export const config = { matcher: ["/projects/:path*", "/settings"] };
