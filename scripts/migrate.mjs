import { readFile } from "node:fs/promises";
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
const migration = await readFile(
  new URL("../migrations/0001_create_user_state.sql", import.meta.url),
  "utf8",
);

await sql.query(migration);

console.log("Neon migrations applied.");
