import "server-only";

import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "@/src/shared/config/env.server";

let client: ReturnType<typeof neon> | null = null;

export function database(): ReturnType<typeof neon> {
  if (client) return client;
  client = neon(getDatabaseUrl());
  return client;
}
