import type { PlanningCommand, PlanningResult } from "../application/contracts";
import type { Priority } from "@/src/modules/priorities/domain/priority";
import type { MonthlyPlan } from "../domain/monthly-plan";

export type PriorityView = Priority & { version: number };
export type PlanView = MonthlyPlan & { version: number };
export type MonthData = { priorities: PriorityView[]; plans: PlanView[] };
export interface PlanningClient {
  load(month: string): Promise<MonthData>;
  execute(operationId: string, command: PlanningCommand): Promise<PlanningResult>;
}
