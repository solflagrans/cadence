import { z } from "zod";
import { createPriorityInputSchema, priorityNameSchema, prioritySchema } from "@/src/modules/priorities/domain/priority";
import { monthlyPlanSchema, monthSchema, targetSchema } from "../domain/monthly-plan";

const version = z.number().int().positive().max(2_147_483_646);
export const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), priority: createPriorityInputSchema, month: monthSchema, target: targetSchema }),
  z.strictObject({ action: z.literal("add"), priorityId: z.uuid(), month: monthSchema, target: targetSchema }),
  z.strictObject({ action: z.literal("rename"), priorityId: z.uuid(), expectedVersion: version, name: priorityNameSchema }),
  z.strictObject({ action: z.literal("archive"), priorityId: z.uuid(), expectedVersion: version, archived: z.boolean() }),
  z.strictObject({ action: z.literal("target"), planId: z.uuid(), expectedVersion: version, target: targetSchema }),
  z.strictObject({ action: z.literal("remove"), planId: z.uuid(), expectedVersion: version }),
]);
export const requestSchema = z.strictObject({ operationId: z.uuid(), command: commandSchema });
export const ownerSchema = z.string().trim().min(1);
const storedVersion = z.number().int().positive().max(2_147_483_647);
export const priorityViewSchema = prioritySchema.extend({ version: storedVersion });
export const planViewSchema = monthlyPlanSchema.extend({ version: storedVersion });
export const resultSchema = z.strictObject({
  priority: priorityViewSchema.optional(), plan: planViewSchema.optional(), deletedPlanId: z.uuid().optional(),
});
export type PlanningResult = z.infer<typeof resultSchema>;
export type PlanningCommand = z.input<typeof commandSchema>;
export type PlanningErrorCode = "invalid" | "not_found" | "conflict" | "duplicate" | "archived" | "metric_mismatch" | "operation_reused" | "has_dependencies";
export class PlanningError extends Error {
  constructor(public readonly code: PlanningErrorCode) { super(code); }
}

