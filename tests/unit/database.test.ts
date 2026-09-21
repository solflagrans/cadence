import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ end: vi.fn(), pool: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({
  neonConfig: {},
  Pool: class {
    constructor(options: unknown) { mocks.pool(options); }
    end = mocks.end;
  },
}));
vi.mock("drizzle-orm/neon-serverless", () => ({ drizzle: () => ({}) }));

import { withDatabase } from "@/src/shared/database/client.server";

afterEach(() => vi.unstubAllEnvs());

describe("database connection lifecycle", () => {
  it("releases the pool after a successful operation", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@example.neon.tech/db");
    await expect(withDatabase(async () => 42)).resolves.toBe(42);
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("releases the pool and propagates an operation failure", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@example.neon.tech/db");
    const error = new Error("Transaction failed");
    await expect(withDatabase(async () => { throw error; })).rejects.toBe(error);
    expect(mocks.end).toHaveBeenCalledOnce();
  });

  it("does not open a connection when configuration is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const operation = vi.fn();
    await expect(withDatabase(operation)).rejects.toThrow("DATABASE_URL");
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });
});
