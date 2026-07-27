import "server-only";

import { randomUUID } from "node:crypto";
import type { AccountIdentity } from "@/src/domain/identity/account";
import { database } from "./client.server";

type IdentityRow = { app_user_id: string };

export async function resolveAppUserId(
  account: AccountIdentity,
): Promise<string> {
  const sql = database();
  const candidateUserId = randomUUID();
  const identityKey = `${account.provider}:${account.subject}`;
  const results = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(hashtextextended(${identityKey}, 0))`,
    tx`
      INSERT INTO app_user (id)
      SELECT ${candidateUserId}::uuid
      WHERE NOT EXISTS (
        SELECT 1 FROM auth_identity
        WHERE provider = ${account.provider}
          AND subject = ${account.subject}
      )
    `,
    tx`
      INSERT INTO auth_identity (
        provider, subject, app_user_id, email, updated_at
      )
      VALUES (
        ${account.provider},
        ${account.subject},
        COALESCE(
          (
            SELECT app_user_id FROM auth_identity
            WHERE provider = ${account.provider}
              AND subject = ${account.subject}
          ),
          ${candidateUserId}::uuid
        ),
        ${account.email},
        now()
      )
      ON CONFLICT (provider, subject) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now()
      RETURNING app_user_id
    `,
  ]) as unknown as Record<string, unknown>[][];
  const row = results[2][0] as IdentityRow | undefined;
  if (!row) throw new Error("Unable to resolve application user");
  return row.app_user_id;
}
