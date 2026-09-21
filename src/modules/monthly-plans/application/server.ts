import "server-only";

import { withDatabase } from "@/src/shared/database/client.server";
import { createPlanningService } from "./planning.server";

// These are internal functions, not Server Actions or public HTTP endpoints.
// The future Auth adapter must resolve ownerId from the session on each call.
export const executePlanningOperation = (ownerId: string, input: unknown) =>
  withDatabase((db) => createPlanningService(db).execute(ownerId, input));
export const listMonth = (ownerId: string, month: string) =>
  withDatabase((db) => createPlanningService(db).listMonth(ownerId, month));
export const listPriorities = (ownerId: string) =>
  withDatabase((db) => createPlanningService(db).listPriorities(ownerId));
