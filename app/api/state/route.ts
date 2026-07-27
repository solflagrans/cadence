import { getCurrentAccount } from "@/app/lib/auth/server";
import { resolveAppUserId } from "@/app/lib/accounts";
import { database } from "@/app/lib/database";
import { normalizePlannerData } from "@/app/lib/normalize-planner-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STATE_BYTES = 1_000_000;

type StateRow = {
  data: unknown;
  revision: number;
  updated_at: string;
};

const json = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
};

const bodyState = (body: unknown): unknown => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return (body as Record<string, unknown>).data;
};

const bodyRevision = (body: unknown): number | null => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const revision = (body as Record<string, unknown>).revision;
  return typeof revision === "number" &&
    Number.isSafeInteger(revision) &&
    revision >= 0
    ? revision
    : null;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const logError = (
  event: "state_load_failed" | "state_save_failed",
  userId: string,
  error: unknown,
): void => {
  console.error({
    event,
    userId,
    error: errorMessage(error),
  });
};

export async function GET(): Promise<Response> {
  try {
    const account = await getCurrentAccount();
    if (!account) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = await resolveAppUserId(account);
    const sql = database();
    const rows = await sql`
      SELECT data, revision, updated_at::text AS updated_at
      FROM user_state
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `;
    const row = rows[0] as StateRow | undefined;

    if (!row) {
      return json({ error: "State not found" }, { status: 404 });
    }

    const data = normalizePlannerData(row.data);
    if (!data) {
      throw new Error("Stored state has an unsupported version");
    }

    return json({
      data,
      revision: Number(row.revision),
      updatedAt: row.updated_at,
    });
  } catch (error) {
    logError("state_load_failed", "unknown", error);
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
  const expectedRevision = bodyRevision(body);
  if (expectedRevision === null) {
    return json({ error: "Invalid revision" }, { status: 400 });
  }

  const serialized = JSON.stringify(data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) {
    return json({ error: "State is too large" }, { status: 413 });
  }

  try {
    const account = await getCurrentAccount();
    if (!account) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = await resolveAppUserId(account);
    const sql = database();
    const rows = await sql`
      INSERT INTO user_state (
        user_id,
        data,
        schema_version,
        revision,
        updated_at
      )
      SELECT
        ${userId}::uuid,
        ${serialized}::jsonb,
        ${data.version},
        1,
        now()
      WHERE ${expectedRevision} = 0
        OR EXISTS (
          SELECT 1
          FROM user_state
          WHERE user_id = ${userId}::uuid
            AND revision = ${expectedRevision}
        )
      ON CONFLICT (user_id) DO UPDATE SET
        data = EXCLUDED.data,
        schema_version = EXCLUDED.schema_version,
        revision = user_state.revision + 1,
        updated_at = now()
      WHERE user_state.revision = ${expectedRevision}
      RETURNING revision, updated_at::text AS updated_at
    `;
    const saved = rows[0] as
      | { revision: number; updated_at: string }
      | undefined;

    if (!saved) {
      const current = await sql`
        SELECT revision
        FROM user_state
        WHERE user_id = ${userId}::uuid
      `;
      return json(
        {
          error: "State conflict",
          revision: Number(current[0]?.revision ?? 0),
        },
        { status: 409 },
      );
    }

    return json({
      revision: Number(saved.revision),
      updatedAt: saved.updated_at,
    });
  } catch (error) {
    logError("state_save_failed", "unknown", error);
    return json({ error: "Unable to save state" }, { status: 500 });
  }
}
