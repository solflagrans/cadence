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

for (const file of migrationFiles) {
  const migration = await readFile(new URL(file, migrationsDirectory), "utf8");
  try {
    await sql.query(migration);
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
