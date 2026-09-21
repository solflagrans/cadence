import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/src/shared/database/client.server";
import * as schema from "@/src/shared/database/schema";
import { createPlanningService, type PlanningCommand } from "@/src/modules/monthly-plans/application/planning.server";

vi.mock("server-only", () => ({}));

const pg = new PGlite();
const db = drizzle(pg, { schema });
// The production and test adapters run the same PostgreSQL queries/transactions.
const service = createPlanningService(db as unknown as Database);
const command = (): PlanningCommand => ({
  action: "create", priority: { name: "Английский", metric: { kind: "time" } },
  month: "2026-09", target: { kind: "time", minutes: 720 },
});
const execute = (value: PlanningCommand, owner = "alice", operationId = randomUUID()) =>
  service.execute(owner, { operationId, command: value });
async function created() {
  const result = await execute(command());
  return { priority: result.priority!, plan: result.plan! };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "migrations" });
}, 30_000);
beforeEach(async () => {
  await pg.exec("TRUNCATE monthly_plans, priorities, planning_operations");
});
afterAll(async () => { await pg.close(); });

describe("persisted planning operations", () => {
  it("creates priority and plan, and reads them through a new service instance", async () => {
    const result = await created();
    const fresh = createPlanningService(db as unknown as Database);
    expect(await fresh.listMonth("alice", "2026-09")).toEqual([result]);
    expect(await fresh.listMonth("alice", "2026-10")).toEqual([]);
    expect(await fresh.listPriorities("alice")).toEqual([result.priority]);
  });

  it("isolates reads and every mutation from another owner", async () => {
    const { priority, plan } = await created();
    expect(await service.listPriorities("bob")).toEqual([]);
    expect(await service.listMonth("bob", "2026-09")).toEqual([]);
    const foreignCommands: PlanningCommand[] = [
      { action: "add", priorityId: priority.id, month: "2026-10", target: plan.target },
      { action: "rename", priorityId: priority.id, expectedVersion: 1, name: "Другой" },
      { action: "archive", priorityId: priority.id, expectedVersion: 1, archived: true },
      { action: "target", planId: plan.id, expectedVersion: 1, target: { kind: "time", minutes: 1 } },
      { action: "remove", planId: plan.id, expectedVersion: 1 },
    ];
    for (const value of foreignCommands) await expect(execute(value, "bob")).rejects.toMatchObject({ code: "not_found" });
    expect(await service.listMonth("alice", "2026-09")).toEqual([{ priority, plan }]);
  });

  it("rejects owner fields in input", async () => {
    await expect(service.execute("alice", { operationId: randomUUID(), command: command(), ownerId: "bob" }))
      .rejects.toMatchObject({ code: "invalid" });
  });

  it("replays concurrent identical requests and rejects key reuse with different content", async () => {
    const operationId = randomUUID();
    const [first, second] = await Promise.all([execute(command(), "alice", operationId), execute(command(), "alice", operationId)]);
    expect(second).toEqual(first);
    expect(await service.listPriorities("alice")).toHaveLength(1);
    expect(await service.listMonth("alice", "2026-09")).toHaveLength(1);
    await expect(execute({ ...command(), month: "2026-10" } as PlanningCommand, "alice", operationId))
      .rejects.toMatchObject({ code: "operation_reused" });
    // A different user has an independent key namespace.
    expect((await execute(command(), "bob", operationId)).priority!.ownerId).toBe("bob");
  });

  it("rolls back the priority and operation receipt if creating its plan fails", async () => {
    const operationId = randomUUID();
    const invalid = { ...command(), target: { kind: "quantity", amount: 12 } };
    await expect(service.execute("alice", { operationId, command: invalid })).rejects.toMatchObject({ code: "metric_mismatch" });
    expect(await service.listPriorities("alice")).toEqual([]);
    expect((await pg.query("SELECT * FROM planning_operations")).rows).toEqual([]);
    await expect(execute(command(), "alice", operationId)).resolves.toHaveProperty("plan");
  });

  it("allows one plan per priority/month and independent targets across months", async () => {
    const { priority, plan } = await created();
    const add: PlanningCommand = { action: "add", priorityId: priority.id, month: "2026-10", target: { kind: "time", minutes: 60 } };
    await execute(add);
    await expect(execute(add)).rejects.toMatchObject({ code: "duplicate" });
    expect((await service.listMonth("alice", "2026-09"))[0].plan).toEqual(plan);
    expect((await service.listMonth("alice", "2026-10"))[0].plan.target).toEqual({ kind: "time", minutes: 60 });
  });

  it("rejects stale priority and plan versions without changing saved values", async () => {
    const { priority, plan } = await created();
    const rename: PlanningCommand = { action: "rename", priorityId: priority.id, expectedVersion: 1, name: "Разговорный" };
    const operationId = randomUUID();
    const renamed = await execute(rename, "alice", operationId);
    expect(renamed.priority!.version).toBe(2);
    expect(await execute(rename, "alice", operationId)).toEqual(renamed);
    await expect(execute(rename)).rejects.toMatchObject({ code: "conflict" });
    await expect(execute({ action: "archive", priorityId: priority.id, expectedVersion: 1, archived: true }))
      .rejects.toMatchObject({ code: "conflict" });
    const target: PlanningCommand = { action: "target", planId: plan.id, expectedVersion: 1, target: { kind: "time", minutes: 100 } };
    expect((await execute(target)).plan!.version).toBe(2);
    await expect(execute(target)).rejects.toMatchObject({ code: "conflict" });
    await expect(execute({ action: "remove", planId: plan.id, expectedVersion: 1 })).rejects.toMatchObject({ code: "conflict" });
    const [saved] = await service.listMonth("alice", "2026-09");
    expect(saved.priority.name).toBe("Разговорный");
    expect(saved.plan.target).toEqual({ kind: "time", minutes: 100 });
  });

  it("allows only one of two competing edits to succeed", async () => {
    const { plan } = await created();
    const results = await Promise.allSettled([100, 200].map((minutes) => execute({
      action: "target", planId: plan.id, expectedVersion: 1, target: { kind: "time", minutes },
    })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "conflict" } });
  });

  it("archives without losing plans, edits old plans and adds new ones after restoration", async () => {
    const { priority, plan } = await created();
    await execute({ action: "archive", priorityId: priority.id, expectedVersion: 1, archived: true });
    const add: PlanningCommand = { action: "add", priorityId: priority.id, month: "2026-10", target: plan.target };
    await expect(execute(add)).rejects.toMatchObject({ code: "archived" });
    expect((await service.listMonth("alice", "2026-09"))[0].plan).toEqual(plan);
    await execute({ action: "target", planId: plan.id, expectedVersion: 1, target: { kind: "time", minutes: 30 } });
    await execute({ action: "archive", priorityId: priority.id, expectedVersion: 2, archived: false });
    await expect(execute(add)).resolves.toHaveProperty("plan");
  });

  it("removes only the selected month and replays deletion", async () => {
    const { priority, plan } = await created();
    await execute({ action: "add", priorityId: priority.id, month: "2026-10", target: plan.target });
    const removal: PlanningCommand = { action: "remove", planId: plan.id, expectedVersion: 1 };
    const operationId = randomUUID();
    expect(await execute(removal, "alice", operationId)).toEqual({ deletedPlanId: plan.id });
    expect(await execute(removal, "alice", operationId)).toEqual({ deletedPlanId: plan.id });
    expect(await service.listMonth("alice", "2026-09")).toEqual([]);
    expect(await service.listMonth("alice", "2026-10")).toHaveLength(1);
    expect(await service.listPriorities("alice")).toHaveLength(1);
  });

  it.each([
    { kind: "quantity" as const, amount: 12, unit: "занятий" },
    { kind: "volume" as const, amount: "999999999.999", unit: "км" },
    { kind: "volume" as const, amount: "12,500", unit: "л" },
  ])("roundtrips $kind without losing precision", async ({ kind, amount, unit }) => {
    const result = await execute({ action: "create", priority: { name: "Приоритет", metric: { kind, unit } },
      month: "2026-09", target: { kind, amount } } as PlanningCommand);
    expect((await service.listMonth("alice", "2026-09"))[0].plan).toEqual(result.plan);
    if (amount === "12,500") expect(result.plan!.target).toEqual({ kind: "volume", amount: "12.5" });
    else expect(result.plan!.target).toEqual({ kind, amount });
  });

  it("rejects changing a plan's metric", async () => {
    const { plan } = await created();
    await expect(execute({ action: "target", planId: plan.id, expectedVersion: 1, target: { kind: "quantity", amount: 12 } }))
      .rejects.toMatchObject({ code: "metric_mismatch" });
  });
});

describe("database constraints bypassing application validation", () => {
  it("rejects cross-owner and mismatched metric references", async () => {
    const { priority } = await created();
    for (const [owner, kind] of [["bob", "time"], ["alice", "quantity"]]) {
      await expect(pg.query("INSERT INTO monthly_plans (id, owner_id, priority_id, month, kind, amount) VALUES ($1, $2, $3, '2026-10', $4, 12)",
        [randomUUID(), owner, priority.id, kind])).rejects.toMatchObject({ code: "23503" });
    }
  });

  it.each(["0", "-1", "1.5", "2147483648", "NaN", "Infinity"])("rejects invalid integer amount %s", async (value) => {
    const { plan } = await created();
    await expect(pg.query("UPDATE monthly_plans SET amount = $1 WHERE id = $2", [value, plan.id])).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects excessive decimal precision instead of silently rounding", async () => {
    const result = await execute({ action: "create", priority: { name: "Бег", metric: { kind: "volume", unit: "км" } },
      month: "2026-09", target: { kind: "volume", amount: "12.5" } });
    await expect(pg.query("UPDATE monthly_plans SET amount = 12.0001 WHERE id = $1", [result.plan!.id]))
      .rejects.toMatchObject({ code: "23514" });
  });

  it("rejects invalid months, units and deleting a priority with plans", async () => {
    const { priority, plan } = await created();
    for (const month of ["0000-01", "2026-13", "2026-1", "2026-01-01"]) {
      await expect(pg.query("UPDATE monthly_plans SET month = $1 WHERE id = $2", [month, plan.id])).rejects.toMatchObject({ code: "23514" });
    }
    await expect(pg.query("UPDATE priorities SET unit = 'км' WHERE id = $1", [priority.id])).rejects.toMatchObject({ code: "23514" });
    await expect(pg.query("DELETE FROM priorities WHERE id = $1", [priority.id])).rejects.toMatchObject({ code: "23001" });
  });

  it("preserves a plan when future dependent records restrict deletion", async () => {
    const { plan } = await created();
    await pg.exec("CREATE TABLE future_records (plan_id uuid REFERENCES monthly_plans(id) ON DELETE RESTRICT)");
    try {
      await pg.query("INSERT INTO future_records VALUES ($1)", [plan.id]);
      await expect(execute({ action: "remove", planId: plan.id, expectedVersion: 1 }))
        .rejects.toMatchObject({ code: "has_dependencies" });
      expect(await service.listMonth("alice", "2026-09")).toHaveLength(1);
    } finally {
      await pg.exec("DROP TABLE future_records");
    }
  });
});
