const FIXED_USER_ID = "guest";
const MAX_STATE_BYTES = 1_000_000;
const STATE_PATH = "/api/state";

const json = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
};

const resolveUserId = (): string => {
  // Replace this fixed identity with a verified session user ID when auth is added.
  return FIXED_USER_ID;
};

const isSupportedState = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return (
    state.version === 2 &&
    Array.isArray(state.activityTypes) &&
    Array.isArray(state.directions) &&
    Array.isArray(state.days) &&
    Array.isArray(state.months) &&
    Array.isArray(state.weeks) &&
    Array.isArray(state.completions) &&
    Array.isArray(state.extraResults) &&
    Boolean(state.settings && typeof state.settings === "object")
  );
};

const getStateFromBody = (body: unknown): unknown => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return (body as Record<string, unknown>).data;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const logError = (
  event: "state_load_failed" | "state_save_failed",
  request: Request,
  userId: string,
  error: unknown,
): void => {
  console.error(JSON.stringify({
    event,
    userId,
    ray: request.headers.get("cf-ray"),
    error: errorMessage(error),
  }));
};

async function loadState(request: Request, env: Env, userId: string): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT data, updated_at FROM user_state WHERE user_id = ?1",
    )
      .bind(userId)
      .first<{ data: string; updated_at: string }>();

    if (!row) {
      return json({ error: "State not found" }, { status: 404 });
    }

    return json({
      data: JSON.parse(row.data) as unknown,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    logError("state_load_failed", request, userId, error);
    return json({ error: "Unable to load state" }, { status: 500 });
  }
}

async function saveState(request: Request, env: Env, userId: string): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_STATE_BYTES) {
    return json({ error: "State is too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const state = getStateFromBody(body);
  if (!isSupportedState(state)) {
    return json({ error: "Invalid state" }, { status: 400 });
  }

  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) {
    return json({ error: "State is too large" }, { status: 413 });
  }

  try {
    const updatedAt = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO user_state (user_id, data, updated_at)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(user_id) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at`,
    )
      .bind(userId, serialized, updatedAt)
      .run();

    return json({ updatedAt });
  } catch (error) {
    logError("state_save_failed", request, userId, error);
    return json({ error: "Unable to save state" }, { status: 500 });
  }
}

async function handleStateRequest(request: Request, env: Env): Promise<Response> {
  const userId = resolveUserId();

  if (request.method === "GET") {
    return loadState(request, env, userId);
  }
  if (request.method === "PUT") {
    return saveState(request, env, userId);
  }

  return json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "GET, PUT" } },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === STATE_PATH) {
      return handleStateRequest(request, env);
    }
    if (pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
