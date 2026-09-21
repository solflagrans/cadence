import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

import { readDatabaseConfig } from "./src/shared/config/env";

loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/database/schema.ts",
  out: "./migrations",
  // Schema generation works offline. Migration and Studio require DATABASE_URL.
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: readDatabaseConfig().DATABASE_URL } }
    : {}),
  strict: true,
});
