import { readFile, readdir } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is missing. Connect a Neon database to the Vercel project before deploying.",
    );
  }
  console.log("DATABASE_URL is not set; skipping Neon migrations for this local build.");
  process.exit(0);
}

const sql = neon(connectionString);
const migrationsDirectory = new URL("../migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const appliedRows = await sql`SELECT version FROM schema_migrations`;
const applied = new Set(appliedRows.map((row) => row.version));

for (const file of migrationFiles) {
  if (applied.has(file)) {
    console.log(`Skipped ${file}`);
    continue;
  }
  const migration = await readFile(new URL(file, migrationsDirectory), "utf8");
  try {
    await sql.transaction((tx) => [
      tx`SELECT pg_advisory_xact_lock(hashtextextended('cadence-migrations', 0))`,
      tx.query(migration),
      tx`
        INSERT INTO schema_migrations (version)
        VALUES (${file})
        ON CONFLICT (version) DO NOTHING
      `,
    ]);
    console.log(`Applied ${file}`);
  } catch (error) {
    console.error(`Failed to apply ${file}`, {
      message: error instanceof Error ? error.message : String(error),
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
    });
    throw error;
  }
}

console.log("Neon migrations applied.");
