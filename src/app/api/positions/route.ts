import { getPositions, publicDataError, readQueryParam } from "../../../lib/public-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const positions = await getPositions(readQueryParam(new URL(request.url).searchParams, "account") ?? "");
    return Response.json(positions, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = publicDataError(error);
    return Response.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
}
