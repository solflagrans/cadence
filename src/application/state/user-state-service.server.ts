import "server-only";

import type { AccountIdentity } from "@/src/domain/identity/account";
import type { PlannerData } from "@/src/domain/planner/model/types";
import { normalizePlannerData } from "@/src/domain/planner/validation/normalize-planner-state";
import { resolveAppUserId } from "@/src/infrastructure/database/app-user-repository.server";
import {
  findUserState,
  saveUserState,
  type SaveUserStateResult,
} from "@/src/infrastructure/database/user-state-repository.server";

export async function loadAccountState(account: AccountIdentity): Promise<{
  data: PlannerData;
  revision: number;
  updatedAt: string;
} | null> {
  const userId = await resolveAppUserId(account);
  const stored = await findUserState(userId);
  if (!stored) return null;
  const data = normalizePlannerData(stored.data);
  if (!data) throw new Error("Stored state has an unsupported version");
  return {
    data,
    revision: stored.revision,
    updatedAt: stored.updatedAt,
  };
}

export async function saveAccountState(
  account: AccountIdentity,
  data: PlannerData,
  revision: number,
): Promise<SaveUserStateResult> {
  const userId = await resolveAppUserId(account);
  return saveUserState(userId, data, revision);
}
