CREATE TYPE "public"."metric_kind" AS ENUM('time', 'quantity', 'volume');--> statement-breakpoint
CREATE TABLE "monthly_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"priority_id" uuid NOT NULL,
	"month" text NOT NULL,
	"kind" "metric_kind" NOT NULL,
	"amount" numeric NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "monthly_plans_owner_priority_month_unique" UNIQUE("owner_id","priority_id","month"),
	CONSTRAINT "monthly_plans_month_valid" CHECK ("monthly_plans"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and left("monthly_plans"."month", 4) <> '0000'),
	CONSTRAINT "monthly_plans_amount_valid" CHECK ("monthly_plans"."amount" > 0 and (("monthly_plans"."kind" in ('time', 'quantity') and "monthly_plans"."amount" <= 2147483647 and "monthly_plans"."amount" = trunc("monthly_plans"."amount")) or ("monthly_plans"."kind" = 'volume' and "monthly_plans"."amount" <= 999999999.999 and "monthly_plans"."amount" = trunc("monthly_plans"."amount", 3)))),
	CONSTRAINT "monthly_plans_version_valid" CHECK ("monthly_plans"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "planning_operations" (
	"owner_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"request" text NOT NULL,
	"result" jsonb,
	CONSTRAINT "planning_operations_owner_id_operation_id_pk" PRIMARY KEY("owner_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "priorities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "metric_kind" NOT NULL,
	"unit" text,
	"archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "priorities_owner_id_kind_unique" UNIQUE("owner_id","id","kind"),
	CONSTRAINT "priorities_owner_valid" CHECK (length(trim("priorities"."owner_id")) > 0),
	CONSTRAINT "priorities_name_valid" CHECK (length(trim("priorities"."name")) between 1 and 120),
	CONSTRAINT "priorities_unit_valid" CHECK (("priorities"."kind" = 'time' and "priorities"."unit" is null) or ("priorities"."kind" <> 'time' and "priorities"."unit" is not null and length(trim("priorities"."unit")) between 1 and 32)),
	CONSTRAINT "priorities_version_valid" CHECK ("priorities"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_owned_metric_fk" FOREIGN KEY ("owner_id","priority_id","kind") REFERENCES "public"."priorities"("owner_id","id","kind") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "monthly_plans_owner_month_idx" ON "monthly_plans" USING btree ("owner_id","month");