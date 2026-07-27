import { getAuthServer } from "@/app/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthContext = {
  params: Promise<{ path: string[] }>;
};

const unavailable = (): Response =>
  Response.json(
    { error: "Authentication is not configured" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );

export async function GET(
  request: Request,
  context: AuthContext,
): Promise<Response> {
  const auth = getAuthServer();
  if (!auth) return unavailable();
  return auth.handler().GET(request, context);
}

export async function POST(
  request: Request,
  context: AuthContext,
): Promise<Response> {
  const auth = getAuthServer();
  if (!auth) return unavailable();
  return auth.handler().POST(request, context);
}
