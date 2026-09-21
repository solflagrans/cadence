import { createPriority } from "@/src/modules/priorities/domain/priority";
import { createMonthlyPlan, changeMonthlyTarget } from "../domain/monthly-plan";
import { PlanningError, requestSchema, type PlanningResult } from "../application/contracts";
import type { PlanningClient, PlanView, PriorityView } from "./client";

/** Disposable preview data. Never accesses cloud data or browser storage. */
export function createDemoClient(): PlanningClient {
  const priorities = new Map<string, PriorityView>();
  const plans = new Map<string, PlanView>();
  const receipts = new Map<string, { request: string; result: PlanningResult }>();
  return {
    async load(month) {
      return structuredClone({ priorities: [...priorities.values()], plans: [...plans.values()].filter((p) => p.month === month) });
    },
    async execute(operationId, input) {
      const parsed = requestSchema.safeParse({ operationId, command: input });
      if (!parsed.success) throw new PlanningError("invalid");
      const command = parsed.data.command;
      const request = JSON.stringify(command);
      const receipt = receipts.get(operationId);
      if (receipt) {
        if (receipt.request !== request) throw new PlanningError("operation_reused");
        return structuredClone(receipt.result);
      }
      let result: PlanningResult;
      if (command.action === "create" || command.action === "add") {
        const priority = command.action === "create"
          ? { ...createPriority(crypto.randomUUID(), "demo", command.priority), version: 1 }
          : priorities.get(command.priorityId);
        if (!priority) throw new PlanningError("not_found");
        if (priority.archived) throw new PlanningError("archived");
        if (priority.metric.kind !== command.target.kind) throw new PlanningError("metric_mismatch");
        if ([...plans.values()].some((p) => p.priorityId === priority.id && p.month === command.month)) throw new PlanningError("duplicate");
        const plan = { ...createMonthlyPlan(crypto.randomUUID(), priority, command.month, command.target), version: 1 };
        priorities.set(priority.id, priority);
        plans.set(plan.id, plan);
        result = { priority, plan };
      } else if (command.action === "rename" || command.action === "archive") {
        const current = priorities.get(command.priorityId);
        if (!current) throw new PlanningError("not_found");
        if (current.version !== command.expectedVersion) throw new PlanningError("conflict");
        const priority = { ...current, version: current.version + 1, ...(command.action === "rename" ? { name: command.name } : { archived: command.archived }) };
        priorities.set(priority.id, priority);
        result = { priority };
      } else {
        const current = plans.get(command.planId);
        if (!current) throw new PlanningError("not_found");
        if (current.version !== command.expectedVersion) throw new PlanningError("conflict");
        if (command.action === "remove") {
          plans.delete(current.id);
          result = { deletedPlanId: current.id };
        } else {
          if (current.target.kind !== command.target.kind) throw new PlanningError("metric_mismatch");
          const plan = { ...changeMonthlyTarget(current, priorities.get(current.priorityId)!, command.target), version: current.version + 1 };
          plans.set(plan.id, plan);
          result = { plan };
        }
      }
      receipts.set(operationId, { request, result: structuredClone(result) });
      return structuredClone(result);
    },
  };
}
