import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

import { readAuthConfig } from "@/src/shared/config/env";

let auth: ReturnType<typeof createNeonAuth> | undefined;

export function getAuth() {
  if (!auth) {
    const config = readAuthConfig();
    auth = createNeonAuth({
      baseUrl: config.NEON_AUTH_BASE_URL,
      cookies: { secret: config.NEON_AUTH_COOKIE_SECRET },
    });
  }
  return auth;
}
