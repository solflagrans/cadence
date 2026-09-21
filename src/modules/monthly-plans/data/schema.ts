import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";
import { metricKind, priorities } from "@/src/modules/priorities/data/schema";

export const monthlyPlans = pgTable("monthly_plans", {
  id: uuid("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  priorityId: uuid("priority_id").notNull(),
  month: text("month").notNull(),
  kind: metricKind("kind").notNull(),
  // Unconstrained numeric avoids silent rounding before CHECK validation.
  amount: numeric("amount").notNull(),
  version: integer("version").notNull().default(1),
}, (table) => [
  foreignKey({ name: "monthly_plans_owned_metric_fk", columns: [table.ownerId, table.priorityId, table.kind], foreignColumns: [priorities.ownerId, priorities.id, priorities.kind] }).onDelete("restrict").onUpdate("restrict"),
  unique("monthly_plans_owner_priority_month_unique").on(table.ownerId, table.priorityId, table.month),
  index("monthly_plans_owner_month_idx").on(table.ownerId, table.month),
  check("monthly_plans_month_valid", sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and left(${table.month}, 4) <> '0000'`),
  check("monthly_plans_amount_valid", sql`${table.amount} > 0 and ((${table.kind} in ('time', 'quantity') and ${table.amount} <= 2147483647 and ${table.amount} = trunc(${table.amount})) or (${table.kind} = 'volume' and ${table.amount} <= 999999999.999 and ${table.amount} = trunc(${table.amount}, 3)))`),
  check("monthly_plans_version_valid", sql`${table.version} > 0`),
]);

// Stored in the same transaction as the mutation; failed operations leave no receipt.
export const planningOperations = pgTable("planning_operations", {
  ownerId: text("owner_id").notNull(),
  operationId: uuid("operation_id").notNull(),
  request: text("request").notNull(),
  result: jsonb("result"),
}, (table) => [primaryKey({ columns: [table.ownerId, table.operationId] })]);
