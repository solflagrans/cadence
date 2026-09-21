import { z } from "zod";

export const priorityNameSchema = z.string().trim().min(1, "Укажите название")
  .max(120, "Название должно быть не длиннее 120 символов");

const unitSchema = z.string().trim().min(1, "Укажите единицу измерения")
  .max(32, "Не более 32 символов");

export const metricSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("time") }),
  z.strictObject({
    kind: z.literal("quantity"),
    unit: unitSchema,
  }),
  z.strictObject({ kind: z.literal("volume"), unit: unitSchema }),
]);

export const createPriorityInputSchema = z.strictObject({
  name: priorityNameSchema,
  metric: metricSchema,
});

export const prioritySchema = z.strictObject({
  id: z.uuid(),
  ownerId: z.string().trim().min(1),
  name: priorityNameSchema,
  metric: metricSchema,
  archived: z.boolean(),
});

export type Priority = z.infer<typeof prioritySchema>;
export type Metric = z.infer<typeof metricSchema>;

export const metricLabels = {
  time: "Время",
  quantity: "Количество",
  volume: "Объём",
} as const satisfies Record<Metric["kind"], string>;

/** IDs and owner are supplied by the application, never trusted from a form. */
export function createPriority(id: string, ownerId: string, input: unknown): Priority {
  return prioritySchema.parse({
    id, ownerId, ...createPriorityInputSchema.parse(input), archived: false,
  });
}

/** Renaming is global; metric and unit are immutable to preserve comparability. */
export function renamePriority(priority: Priority, name: unknown): Priority {
  return { ...priority, name: priorityNameSchema.parse(name) };
}

/** Archiving never removes monthly plans or recorded results. */
export function archivePriority(priority: Priority): Priority {
  return { ...priority, archived: true };
}

export function restorePriority(priority: Priority): Priority {
  return { ...priority, archived: false };
}
