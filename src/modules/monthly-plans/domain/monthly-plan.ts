import { z } from "zod";

import type { Priority } from "@/src/modules/priorities/domain/priority";

/** A calendar month, not a timestamp. No timezone conversion is needed here. */
export const monthSchema = z.string().regex(
  /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/,
  "Укажите месяц в формате ГГГГ-ММ",
);

/** Exact decimal text: up to 9 integer and 3 fractional digits, never a float. */
export const volumeSchema = z.string().trim()
  .regex(/^(0|[1-9]\d{0,8})([.,]\d{1,3})?$/, "Не более 3 знаков после запятой")
  .refine((value) => /[1-9]/.test(value), "Значение должно быть больше нуля")
  .transform((value) => value.replace(",", ".").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""));

/** Discrete count; fractional values are rejected, never rounded. */
export const quantitySchema = z.number().int("Введите целое число")
  .positive("Значение должно быть больше нуля").max(2_147_483_647);

export const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("time"),
    minutes: z.number().int().positive().max(2_147_483_647),
  }),
  z.strictObject({ kind: z.literal("quantity"), amount: quantitySchema }),
  z.strictObject({ kind: z.literal("volume"), amount: volumeSchema }),
]);

export const monthlyPlanSchema = z.strictObject({
  id: z.uuid(),
  ownerId: z.string().trim().min(1),
  priorityId: z.uuid(),
  month: monthSchema,
  target: targetSchema,
});

export type MonthlyPlan = z.infer<typeof monthlyPlanSchema>;
export type Target = z.infer<typeof targetSchema>;

function parseTarget(priority: Priority, input: unknown): Target {
  const target = targetSchema.parse(input);
  if (target.kind !== priority.metric.kind) {
    throw new Error("Метрика плана должна совпадать с метрикой приоритета");
  }
  return target;
}

/** The application supplies an owned priority and enforces uniqueness in storage. */
export function createMonthlyPlan(
  id: string,
  priority: Priority,
  month: unknown,
  target: unknown,
): MonthlyPlan {
  if (priority.archived) {
    throw new Error("Восстановите приоритет из архива, чтобы добавить его в месяц");
  }
  return monthlyPlanSchema.parse({
    id,
    ownerId: priority.ownerId,
    priorityId: priority.id,
    month: monthSchema.parse(month),
    target: parseTarget(priority, target),
  });
}

/** Existing plans remain editable even when the priority is archived. */
export function changeMonthlyTarget(
  plan: MonthlyPlan,
  priority: Priority,
  target: unknown,
): MonthlyPlan {
  if (plan.priorityId !== priority.id || plan.ownerId !== priority.ownerId) {
    throw new Error("План не принадлежит этому приоритету");
  }
  return { ...plan, target: parseTarget(priority, target) };
}
