import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import type { AccountIdentity } from "./types";

let neonAuth: NeonAuth | null | undefined;

export function getAuthServer(): NeonAuth | null {
  if (neonAuth !== undefined) return neonAuth;

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !cookieSecret) {
    neonAuth = null;
    return neonAuth;
  }

  neonAuth = createNeonAuth({
    baseUrl,
    cookies: { secret: cookieSecret },
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

export const storageUserId = (account: AccountIdentity): string =>
  `${account.provider}:${account.subject}`;
