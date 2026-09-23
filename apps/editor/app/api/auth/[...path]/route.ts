import { getAuth } from "../../../../lib/auth-server";
export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: any) {
  return getAuth().handler().GET(req, ctx);
}
export async function POST(req: Request, ctx: any) {
  return getAuth().handler().POST(req, ctx);
}
