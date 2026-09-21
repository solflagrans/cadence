import "server-only";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { readDatabaseConfig } from "@/src/shared/config/env";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

function createDatabase(pool: Pool) {
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDatabase>;

// Keep each pool within one server operation, including interactive transactions.
export async function withDatabase<T>(operation: (db: Database) => Promise<T>): Promise<T> {
  const { DATABASE_URL } = readDatabaseConfig();
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    return await operation(createDatabase(pool));
  } finally {
    await pool.end();
  }
}
