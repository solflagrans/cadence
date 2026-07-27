import type { PlannerData } from "@/src/domain/planner/model/types";

export type StorageScope =
  | { kind: "guest" }
  | { kind: "account"; userId: string };

export const guestStorageScope: StorageScope = { kind: "guest" };

export type StorageLoadResult = {
  data: PlannerData;
  source: "remote" | "local";
  remoteAvailable: boolean;
};

export class StateConflictError extends Error {
  constructor(readonly remoteRevision: number) {
    super("Remote state has a newer revision");
    this.name = "StateConflictError";
  }
}

export interface StateRepository {
  getCachedState(scope: StorageScope): PlannerData;
  load(scope: StorageScope): Promise<StorageLoadResult>;
  cache(scope: StorageScope, data: PlannerData): void;
  save(
    scope: StorageScope,
    data: PlannerData,
    options?: { revision?: number },
  ): Promise<void>;
}
