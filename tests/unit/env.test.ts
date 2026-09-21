import { describe, expect, it } from "vitest";

import { readAuthConfig, readDatabaseConfig } from "@/src/shared/config/env";

describe("server configuration", () => {
  it("validates database settings independently of authentication", () => {
    const DATABASE_URL = "postgresql://user:password@example.neon.tech/priority?sslmode=require";
    expect(readDatabaseConfig({ DATABASE_URL })).toEqual({ DATABASE_URL });
  });

  it("rejects missing or non-Postgres connections without disclosing values", () => {
    expect(() => readDatabaseConfig({})).toThrow("DATABASE_URL");
    expect(() => readDatabaseConfig({ DATABASE_URL: "https://user:private@example.com" }))
      .toThrow(/^Missing or invalid environment variables: DATABASE_URL$/);
  });

  it("requires HTTPS and a sufficiently long signing secret", () => {
    expect(() => readAuthConfig({
      NEON_AUTH_BASE_URL: "http://example.com/auth",
      NEON_AUTH_COOKIE_SECRET: "private",
    })).toThrow(/^Missing or invalid environment variables: NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET$/);
    expect(readAuthConfig({
      NEON_AUTH_BASE_URL: "https://example.neonauth.us-east-1.aws.neon.tech/neondb/auth",
      NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
    }).NEON_AUTH_COOKIE_SECRET).toHaveLength(32);
  });
});
