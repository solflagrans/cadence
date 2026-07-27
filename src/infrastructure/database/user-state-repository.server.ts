import "server-only";

import type { PlannerData } from "@/src/domain/planner/model/types";
import { database } from "./client.server";

export type StoredUserState = {
  data: unknown;
  revision: number;
  updatedAt: string;
};

export type SaveUserStateResult =
  | { status: "saved"; revision: number; updatedAt: string }
  | { status: "conflict"; revision: number };

export async function findUserState(
  userId: string,
): Promise<StoredUserState | null> {
  const rows = await database()`
    SELECT data, revision, updated_at::text AS updated_at
    FROM user_state
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  ` as unknown as Record<string, unknown>[];
  const row = rows[0] as
    | { data: unknown; revision: number; updated_at: string }
    | undefined;
  return row
    ? {
        data: row.data,
        revision: Number(row.revision),
        updatedAt: row.updated_at,
      }
    : null;
}

export async function saveUserState(
  userId: string,
  data: PlannerData,
  expectedRevision: number,
): Promise<SaveUserStateResult> {
  const sql = database();
  const serialized = JSON.stringify(data);
  const rows = await sql`
    INSERT INTO user_state (
      user_id, data, schema_version, revision, updated_at
    )
    SELECT
      ${userId}::uuid,
      ${serialized}::jsonb,
      ${data.version},
      1,
      now()
    WHERE ${expectedRevision} = 0
      OR EXISTS (
        SELECT 1 FROM user_state
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
  ` as unknown as Record<string, unknown>[];
  const saved = rows[0] as
    | { revision: number; updated_at: string }
    | undefined;
  if (saved) {
    return {
      status: "saved",
      revision: Number(saved.revision),
      updatedAt: saved.updated_at,
    };
  }
  const current = await sql`
    SELECT revision FROM user_state WHERE user_id = ${userId}::uuid
  ` as unknown as Record<string, unknown>[];
  return {
    status: "conflict",
    revision: Number(current[0]?.revision ?? 0),
  };
}
