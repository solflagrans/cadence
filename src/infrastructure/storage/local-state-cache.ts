import type { PlannerData } from "@/src/domain/planner/model/types";
import { normalizePlannerData } from "@/src/domain/planner/validation/normalize-planner-state";
import type { StorageScope } from "@/src/application/sync/state-repository";

const STORAGE_KEY = "cadence-planner-v2";
const LEGACY_STORAGE_KEYS = ["cadence-planner-v1", "sreda-planner-v1"];

const storageKeyFor = (scope: StorageScope): string =>
  scope.kind === "guest"
    ? `${STORAGE_KEY}:guest`
    : `${STORAGE_KEY}:account:${scope.userId}`;

export class LocalStateCache {
  private revisionKey(scope: StorageScope): string {
    return `${storageKeyFor(scope)}:revision`;
  }

  load(scope: StorageScope): PlannerData | null {
    if (typeof window === "undefined") return null;
    try {
      const scopedKey = storageKeyFor(scope);
      const raw =
        window.localStorage.getItem(scopedKey) ??
        (scope.kind === "guest"
          ? window.localStorage.getItem(STORAGE_KEY)
          : null);
      if (!raw) return null;
      const data = normalizePlannerData(JSON.parse(raw) as unknown);
      if (data && !window.localStorage.getItem(scopedKey)) {
        window.localStorage.setItem(scopedKey, JSON.stringify(data));
      }
      return data;
    } catch {
      return null;
    }
  }

  save(scope: StorageScope, data: PlannerData): void {
    window.localStorage.setItem(storageKeyFor(scope), JSON.stringify(data));
    if (scope.kind === "guest") {
      window.localStorage.removeItem(STORAGE_KEY);
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }
  }

  loadRevision(scope: StorageScope): number {
    if (typeof window === "undefined" || scope.kind === "guest") return 0;
    const value = Number(window.localStorage.getItem(this.revisionKey(scope)));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  saveRevision(scope: StorageScope, revision: number): void {
    if (scope.kind === "account") {
      window.localStorage.setItem(this.revisionKey(scope), String(revision));
    }
  }
}
