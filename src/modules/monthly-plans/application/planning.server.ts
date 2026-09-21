import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/src/shared/database/client.server";
import { priorities } from "@/src/modules/priorities/data/schema";
import { createPriority } from "@/src/modules/priorities/domain/priority";
import { monthlyPlans, planningOperations } from "../data/schema";
import { createMonthlyPlan, monthSchema, targetSchema } from "../domain/monthly-plan";

import { ownerSchema, requestSchema, resultSchema, priorityViewSchema, planViewSchema, PlanningError, type PlanningResult } from "./contracts";
export { PlanningError, type PlanningCommand, type PlanningResult } from "./contracts";

type PriorityRow = typeof priorities.$inferSelect;
type PlanRow = typeof monthlyPlans.$inferSelect;
function priorityView(row: PriorityRow) {
  return priorityViewSchema.parse({
    id: row.id, ownerId: row.ownerId, name: row.name, archived: row.archived, version: row.version,
    metric: row.kind === "time" ? { kind: "time" } : { kind: row.kind, unit: row.unit },
  });
}
function planView(row: PlanRow) {
  const target = row.kind === "time" ? { kind: "time", minutes: Number(row.amount) }
    : row.kind === "quantity" ? { kind: "quantity", amount: Number(row.amount) }
      : { kind: "volume", amount: row.amount };
  return planViewSchema.parse({ id: row.id, ownerId: row.ownerId, priorityId: row.priorityId, month: row.month, target, version: row.version });
}
function amount(target: z.infer<typeof targetSchema>) {
  return target.kind === "time" ? String(target.minutes) : String(target.amount);
}
function databaseCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return databaseCode(error.cause);
}

/** Internal server service. ownerId MUST come from trusted server context, never a request body. */
export function createPlanningService(db: Database) {
  return {
    async listMonth(ownerId: string, month: string) {
      const owner = ownerSchema.parse(ownerId);
      const period = monthSchema.parse(month);
      const rows = await db.select({ priority: priorities, plan: monthlyPlans }).from(monthlyPlans)
        .innerJoin(priorities, and(eq(priorities.id, monthlyPlans.priorityId), eq(priorities.ownerId, monthlyPlans.ownerId)))
        .where(and(eq(monthlyPlans.ownerId, owner), eq(monthlyPlans.month, period)))
        .orderBy(priorities.name, priorities.id);
      return rows.map((row) => ({ priority: priorityView(row.priority), plan: planView(row.plan) }));
    },
    async listPriorities(ownerId: string) {
      const rows = await db.select().from(priorities).where(eq(priorities.ownerId, ownerSchema.parse(ownerId)))
        .orderBy(priorities.name, priorities.id);
      return rows.map(priorityView);
    },
    async execute(ownerId: string, input: unknown): Promise<PlanningResult> {
      const parsed = requestSchema.safeParse(input);
      const owner = ownerSchema.safeParse(ownerId);
      if (!parsed.success || !owner.success) throw new PlanningError("invalid");
      const { operationId, command } = parsed.data;
      // Zod creates properties in schema order and normalizes values before serialization.
      const request = JSON.stringify(command);
      try {
        return await db.transaction(async (tx) => {
          const key = and(eq(planningOperations.ownerId, owner.data), eq(planningOperations.operationId, operationId));
          const claimed = await tx.insert(planningOperations).values({ ownerId: owner.data, operationId, request })
            .onConflictDoNothing().returning();
          if (!claimed.length) {
            const [receipt] = await tx.select().from(planningOperations).where(key);
            if (!receipt || receipt.request !== request) throw new PlanningError("operation_reused");
            return resultSchema.parse(receipt.result);
          }
          let result: PlanningResult;
          if (command.action === "create" || command.action === "add") {
            let priority;
            if (command.action === "create") {
              const value = createPriority(randomUUID(), owner.data, command.priority);
              const [row] = await tx.insert(priorities).values({
                id: value.id, ownerId: value.ownerId, name: value.name, kind: value.metric.kind,
                unit: value.metric.kind === "time" ? null : value.metric.unit,
              }).returning();
              priority = priorityView(row);
            } else {
              // Serialize with archive/restore to avoid adding to an already archived priority.
              const [row] = await tx.select().from(priorities).where(and(eq(priorities.id, command.priorityId), eq(priorities.ownerId, owner.data))).for("update");
              if (!row) throw new PlanningError("not_found");
              priority = priorityView(row);
            }
            if (priority.archived) throw new PlanningError("archived");
            if (priority.metric.kind !== command.target.kind) throw new PlanningError("metric_mismatch");
            const value = createMonthlyPlan(randomUUID(), priority, command.month, command.target);
            const [row] = await tx.insert(monthlyPlans).values({
              id: value.id, ownerId: owner.data, priorityId: priority.id, month: value.month,
              kind: value.target.kind, amount: amount(value.target),
            }).returning();
            result = { priority, plan: planView(row) };
          } else if (command.action === "rename" || command.action === "archive") {
            const [current] = await tx.select().from(priorities).where(and(eq(priorities.id, command.priorityId), eq(priorities.ownerId, owner.data))).for("update");
            if (!current) throw new PlanningError("not_found");
            if (current.version !== command.expectedVersion) throw new PlanningError("conflict");
            const [row] = await tx.update(priorities).set({
              ...(command.action === "rename" ? { name: command.name } : { archived: command.archived }),
              version: sql`${priorities.version} + 1`,
            }).where(and(eq(priorities.id, current.id), eq(priorities.ownerId, owner.data))).returning();
            result = { priority: priorityView(row) };
          } else {
            const [current] = await tx.select().from(monthlyPlans).where(and(eq(monthlyPlans.id, command.planId), eq(monthlyPlans.ownerId, owner.data))).for("update");
            if (!current) throw new PlanningError("not_found");
            if (current.version !== command.expectedVersion) throw new PlanningError("conflict");
            const condition = and(eq(monthlyPlans.id, current.id), eq(monthlyPlans.ownerId, owner.data));
            if (command.action === "remove") {
              // Future dependent records must reference plans with ON DELETE RESTRICT.
              await tx.delete(monthlyPlans).where(condition);
              result = { deletedPlanId: current.id };
            } else {
              if (current.kind !== command.target.kind) throw new PlanningError("metric_mismatch");
              const [row] = await tx.update(monthlyPlans).set({ amount: amount(command.target), version: sql`${monthlyPlans.version} + 1` })
                .where(condition).returning();
              result = { plan: planView(row) };
            }
          }
          await tx.update(planningOperations).set({ result }).where(key);
          return result;
        });
      } catch (error) {
        if (databaseCode(error) === "23505") throw new PlanningError("duplicate");
        if (["23503", "23001"].includes(databaseCode(error) ?? "")) throw new PlanningError("has_dependencies");
        throw error;
      }
    },
  };
}
