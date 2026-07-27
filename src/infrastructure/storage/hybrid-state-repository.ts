import { createInitialData } from "@/src/domain/planner/model/defaults";
import type { PlannerData } from "@/src/domain/planner/model/types";
import {
  StateConflictError,
  type StateRepository,
  type StorageLoadResult,
  type StorageScope,
} from "@/src/application/sync/state-repository";
import { ApiStateGateway, StateGatewayError } from "./api-state-gateway";
import { LocalStateCache } from "./local-state-cache";

export class HybridStateRepository implements StateRepository {
  constructor(
    private readonly cacheStore: LocalStateCache,
    private readonly remote: ApiStateGateway,
  ) {}

  getCachedState(scope: StorageScope): PlannerData {
    return this.cacheStore.load(scope) ?? createInitialData();
  }

  async load(scope: StorageScope): Promise<StorageLoadResult> {
    const cached = this.getCachedState(scope);
    if (scope.kind === "guest") {
      return { data: cached, source: "local", remoteAvailable: false };
    }

    try {
      const result = await this.remote.load();
      if (!result) {
        this.cacheStore.saveRevision(scope, 0);
        return { data: cached, source: "local", remoteAvailable: true };
      }
      this.cacheStore.save(scope, result.data);
      this.cacheStore.saveRevision(scope, result.revision);
      return {
        data: result.data,
        source: "remote",
        remoteAvailable: true,
      };
    } catch {
      return { data: cached, source: "local", remoteAvailable: false };
    }
  }

  cache(scope: StorageScope, data: PlannerData): void {
    this.cacheStore.save(scope, data);
  }

  async save(
    scope: StorageScope,
    data: PlannerData,
    options?: { revision?: number },
  ): Promise<void> {
    if (scope.kind === "guest") return;
    try {
      const result = await this.remote.save(
        data,
        options?.revision ?? this.cacheStore.loadRevision(scope),
      );
      this.cacheStore.saveRevision(scope, result.revision);
    } catch (error) {
      if (
        error instanceof StateGatewayError &&
        error.status === 409 &&
        typeof error.remoteRevision === "number"
      ) {
        throw new StateConflictError(error.remoteRevision);
      }
      throw error;
    }
  }
}

export const storageRepository: StateRepository = new HybridStateRepository(
  new LocalStateCache(),
  new ApiStateGateway(),
);
