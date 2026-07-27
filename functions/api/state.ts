const FIXED_USER_ID = "guest";
const MAX_STATE_BYTES = 1_000_000;

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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const userId = resolveUserId();

  try {
    const row = await context.env.DB.prepare(
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
    console.error(JSON.stringify({
      event: "state_load_failed",
      userId,
      error: errorMessage(error),
    }));
    return json({ error: "Unable to load state" }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const userId = resolveUserId();
  const contentLength = Number(context.request.headers.get("content-length") ?? "0");

  if (contentLength > MAX_STATE_BYTES) {
    return json({ error: "State is too large" }, { status: 413 });
  }

  try {
    const body: unknown = await context.request.json();
    const state = getStateFromBody(body);
    if (!isSupportedState(state)) {
      return json({ error: "Invalid state" }, { status: 400 });
    }

    const serialized = JSON.stringify(state);
    if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) {
      return json({ error: "State is too large" }, { status: 413 });
    }

    const updatedAt = new Date().toISOString();
    await context.env.DB.prepare(
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
    console.error(JSON.stringify({
      event: "state_save_failed",
      userId,
      error: errorMessage(error),
    }));
    return json({ error: "Unable to save state" }, { status: 500 });
  }
};
