import type { PlannerData } from "./types";
import { createInitialData } from "./data";

const STORAGE_KEY = "cadence-planner-v2";
const LEGACY_STORAGE_KEYS = ["cadence-planner-v1", "sreda-planner-v1"];

export const plannerStorage = {
  load(): PlannerData {
    if (typeof window === "undefined") return createInitialData();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialData();
      const parsed = JSON.parse(raw) as PlannerData;
      return parsed.version === 2 ? parsed : createInitialData();
    } catch {
      return createInitialData();
    }
  },
  save(data: PlannerData) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  },
  reset() {
    window.localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  },
  export(data: PlannerData) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  },
};
