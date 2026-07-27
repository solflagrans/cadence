import { getAuthServer } from "@/src/infrastructure/auth/neon-auth-server";

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

const logRejectedAuthRequest = async (
  response: Response,
  path: string[],
): Promise<void> => {
  if (response.ok) return;
  console.warn({
    event: "auth_request_rejected",
    path: path.join("/"),
    status: response.status,
    detail: (await response.clone().text()).slice(0, 1000),
  });
};

export async function GET(
  request: Request,
  context: AuthContext,
): Promise<Response> {
  const auth = getAuthServer();
  if (!auth) return unavailable();
  const response = await auth.handler().GET(request, context);
  await logRejectedAuthRequest(response, (await context.params).path);
  return response;
}

export async function POST(
  request: Request,
  context: AuthContext,
): Promise<Response> {
  const auth = getAuthServer();
  if (!auth) return unavailable();
  const response = await auth.handler().POST(request, context);
  await logRejectedAuthRequest(response, (await context.params).path);
  return response;
}
