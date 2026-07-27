import "server-only";

export type NeonAuthConfig = {
  baseUrl: string;
  cookieSecret: string;
};

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

export function getNeonAuthConfig(): NeonAuthConfig | null {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  if (!baseUrl || !cookieSecret) return null;
  return { baseUrl, cookieSecret };
}
