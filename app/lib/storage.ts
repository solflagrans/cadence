import type { PlannerData } from "./types";
import { createInitialData } from "./data";
import { normalizePlannerData } from "./normalize-planner-data";

const STORAGE_KEY = "cadence-planner-v2";
const LEGACY_STORAGE_KEYS = ["cadence-planner-v1", "sreda-planner-v1"];
const STATE_API_PATH = "/api/state";

export type StorageScope =
  | { kind: "guest" }
  | { kind: "account"; userId: string };

export const guestStorageScope: StorageScope = { kind: "guest" };

const storageKeyFor = (scope: StorageScope): string =>
  scope.kind === "guest"
    ? `${STORAGE_KEY}:guest`
    : `${STORAGE_KEY}:account:${scope.userId}`;

export type StorageLoadResult = {
  data: PlannerData;
  source: "remote" | "local";
  remoteAvailable: boolean;
};

export interface StorageRepository {
  getCachedState(scope: StorageScope): PlannerData;
  load(scope: StorageScope): Promise<StorageLoadResult>;
  cache(scope: StorageScope, data: PlannerData): void;
  save(scope: StorageScope, data: PlannerData): Promise<void>;
}

class LocalBackup {
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
      const parsed: unknown = JSON.parse(raw);
      const data = normalizePlannerData(parsed);
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
}

type ApiStateResponse = { data: unknown; updatedAt: string };

const isApiStateResponse = (value: unknown): value is ApiStateResponse => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { data?: unknown; updatedAt?: unknown };
  return candidate.data !== undefined && typeof candidate.updatedAt === "string";
};

class ApiStorageRepository implements StorageRepository {
  constructor(
    private readonly backup: LocalBackup,
    private readonly apiPath = STATE_API_PATH,
  ) {}

  getCachedState(scope: StorageScope): PlannerData {
    return this.backup.load(scope) ?? createInitialData();
  }

  async load(scope: StorageScope): Promise<StorageLoadResult> {
    const cached = this.getCachedState(scope);

    if (scope.kind === "guest") {
      return { data: cached, source: "local", remoteAvailable: false };
    }

    try {
      const response = await fetch(this.apiPath, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (response.status === 404) {
        return { data: cached, source: "local", remoteAvailable: true };
      }
      if (!response.ok) {
        throw new Error(`State request failed with status ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (!isApiStateResponse(payload)) {
        throw new Error("State response has an invalid format");
      }
      const normalized = normalizePlannerData(payload.data);
      if (!normalized) {
        throw new Error("State data has an unsupported version");
      }

      this.backup.save(scope, normalized);
      return { data: normalized, source: "remote", remoteAvailable: true };
    } catch {
      return { data: cached, source: "local", remoteAvailable: false };
    }
  }

  cache(scope: StorageScope, data: PlannerData): void {
    this.backup.save(scope, data);
  }

  async save(scope: StorageScope, data: PlannerData): Promise<void> {
    if (scope.kind === "guest") return;

    const response = await fetch(this.apiPath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      throw new Error(`State save failed with status ${response.status}`);
    }
  }
}

export const storageRepository: StorageRepository =
  new ApiStorageRepository(new LocalBackup());

export function downloadPlannerBackup(data: PlannerData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `cadence-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
