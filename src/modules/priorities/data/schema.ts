import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

export const metricKind = pgEnum("metric_kind", ["time", "quantity", "volume"]);

export const priorities = pgTable("priorities", {
  id: uuid("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  kind: metricKind("kind").notNull(),
  unit: text("unit"),
  archived: boolean("archived").notNull().default(false),
  version: integer("version").notNull().default(1),
}, (table) => [
  unique("priorities_owner_id_kind_unique").on(table.ownerId, table.id, table.kind),
  check("priorities_owner_valid", sql`length(trim(${table.ownerId})) > 0`),
  check("priorities_name_valid", sql`length(trim(${table.name})) between 1 and 120`),
  check("priorities_unit_valid", sql`(${table.kind} = 'time' and ${table.unit} is null) or (${table.kind} <> 'time' and ${table.unit} is not null and length(trim(${table.unit})) between 1 and 32)`),
  check("priorities_version_valid", sql`${table.version} > 0`),
]);
