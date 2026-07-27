import "server-only";

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import type { AccountIdentity } from "@/src/domain/identity/account";
import { getNeonAuthConfig } from "@/src/shared/config/env.server";

let neonAuth: NeonAuth | null | undefined;

export function getAuthServer(): NeonAuth | null {
  if (neonAuth !== undefined) return neonAuth;
  const config = getNeonAuthConfig();
  if (!config) {
    neonAuth = null;
    return neonAuth;
  }
  neonAuth = createNeonAuth({
    baseUrl: config.baseUrl,
    cookies: { secret: config.cookieSecret },
  });
  return neonAuth;
}

export async function getCurrentAccount(): Promise<AccountIdentity | null> {
  const auth = getAuthServer();
  if (!auth) return null;
  const { data } = await auth.getSession();
  if (!data?.user) return null;
  return {
    provider: "neon",
    subject: data.user.id,
    name: data.user.name,
    email: data.user.email,
    image: data.user.image,
  };
}
