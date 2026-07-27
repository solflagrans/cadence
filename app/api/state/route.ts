import { neon } from "@neondatabase/serverless";
import { normalizePlannerData } from "@/app/lib/normalize-planner-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_USER_ID = "guest";
const MAX_STATE_BYTES = 1_000_000;

type StateRow = {
  data: string;
  updated_at: string;
};

const json = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
};

const database = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(connectionString);
};

const resolveUserId = (): string => {
  // Replace this fixed identity with a verified session user ID when auth is added.
  return FIXED_USER_ID;
};

const bodyState = (body: unknown): unknown => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return (body as Record<string, unknown>).data;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const logError = (
  event: "state_load_failed" | "state_save_failed",
  error: unknown,
): void => {
  console.error({
    event,
    userId: resolveUserId(),
    error: errorMessage(error),
  });
};

export async function GET(): Promise<Response> {
  const userId = resolveUserId();

  try {
    const sql = database();
    const rows = await sql`
      SELECT data, updated_at
      FROM user_state
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const row = rows[0] as StateRow | undefined;

    if (!row) {
      return json({ error: "State not found" }, { status: 404 });
    }

    const data = normalizePlannerData(JSON.parse(row.data) as unknown);
    if (!data) {
      throw new Error("Stored state has an unsupported version");
    }

    return json({ data, updatedAt: row.updated_at });
  } catch (error) {
    logError("state_load_failed", error);
    return json({ error: "Unable to load state" }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
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

  const data = normalizePlannerData(bodyState(body));
  if (!data) {
    return json({ error: "Invalid state" }, { status: 400 });
  }

  const serialized = JSON.stringify(data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) {
    return json({ error: "State is too large" }, { status: 413 });
  }

  const userId = resolveUserId();
  const updatedAt = new Date().toISOString();

  try {
    const sql = database();
    await sql`
      INSERT INTO user_state (user_id, data, updated_at)
      VALUES (${userId}, ${serialized}, ${updatedAt})
      ON CONFLICT (user_id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at
    `;

    return json({ updatedAt });
  } catch (error) {
    logError("state_save_failed", error);
    return json({ error: "Unable to save state" }, { status: 500 });
  }
}
