import { getAuth } from "../../../../lib/auth-server";
export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: any) {
  if (!process.env.NEON_AUTH_BASE_URL)
    return Response.json(
      {
        error: {
          message:
            "Account setup is not complete yet. The operator must connect Neon authentication.",
        },
      },
      { status: 503 },
    );
  return getAuth().handler().GET(req, ctx);
}
export async function POST(req: Request, ctx: any) {
  if (!process.env.NEON_AUTH_BASE_URL)
    return Response.json(
      {
        error: {
          message:
            "Account setup is not complete yet. The operator must connect Neon authentication.",
        },
      },
      { status: 503 },
    );
  return getAuth().handler().POST(req, ctx);
}
