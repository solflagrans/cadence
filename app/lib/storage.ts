import type { PlannerData } from "./types";
import { createDemoData } from "./data";

const STORAGE_KEY = "cadence-planner-v1";
const LEGACY_STORAGE_KEY = "sreda-planner-v1";

export const plannerStorage = {
  load(): PlannerData {
    if (typeof window === "undefined") return createDemoData();
    try {
      const raw =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return createDemoData();
      return JSON.parse(raw) as PlannerData;
    } catch {
      return createDemoData();
    }
  },
  save(data: PlannerData) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  },
  reset() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
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
