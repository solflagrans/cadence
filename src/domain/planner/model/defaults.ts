import type { PlannerData } from "./types";

export const createInitialData = (): PlannerData => ({
  version: 2,
  activityTypes: [],
  directions: [],
  days: [],
  months: [],
  weeks: [],
  completions: [],
  extraResults: [],
  reviews: [],
  settings: {
    timezone: "Europe/Moscow",
    weekStartsOn: "monday",
    timeFormat: "24",
    language: "ru",
    scheduleRange: 14,
    weekReminder: true,
    monthReminder: true,
    theme: "light",
    density: "comfortable",
  },
});
