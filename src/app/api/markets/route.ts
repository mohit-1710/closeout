import { getMarkets, publicDataError, readQueryParam } from "../../../lib/public-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const markets = await getMarkets({ q: readQueryParam(params, "q"), conditionId: readQueryParam(params, "conditionId") });
    return Response.json({ markets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = publicDataError(error);
    return Response.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  }
}
