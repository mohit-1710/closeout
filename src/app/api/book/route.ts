import { getOrderBook, publicDataError, readQueryParam } from "../../../lib/public-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const book = await getOrderBook({
      tokenId: readQueryParam(params, "tokenId") ?? "",
      conditionId: readQueryParam(params, "conditionId") ?? "",
    });
    return Response.json({ book }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = publicDataError(error);
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
