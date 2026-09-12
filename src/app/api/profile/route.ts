import {
  accountProfileError,
  AccountProfileError,
  getAccountProfile,
} from "../../../lib/account-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    if (params.getAll("input").length !== 1 || params.getAll("source").length > 1) {
      throw new AccountProfileError("Supply one profile input and at most one source.", 400);
    }
    const source = params.get("source") ?? "manual";
    if (source !== "wallet" && source !== "manual") {
      throw new AccountProfileError("Source must be wallet or manual.", 400);
    }
    const profile = await getAccountProfile(params.get("input")!, source);
    return Response.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = accountProfileError(error);
    return Response.json(
      { error: result.error },
      {
        status: result.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
