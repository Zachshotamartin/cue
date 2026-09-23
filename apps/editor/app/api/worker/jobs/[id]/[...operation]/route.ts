import { renderCallback } from "../../../../../../../../packages/cloud/render-api";
export const runtime = "nodejs";
export const maxDuration = 300;
async function handler(
  req: Request,
  context: { params: Promise<{ id: string; operation: string[] }> },
) {
  const p = await context.params;
  try {
    return await renderCallback(req, p.id, p.operation);
  } catch {
    return Response.json(
      { error: "Unable to save render output. Retry this operation." },
      { status: 400 },
    );
  }
}
export { handler as GET, handler as POST, handler as PUT };
