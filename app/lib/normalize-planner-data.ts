import { createInitialData } from "./data";
import type {
  ActivityType,
  AppSettings,
  BreakPeriod,
  Completion,
  DayPlan,
  DaySegment,
  Direction,
  ExtraResult,
  MetricType,
  MonthPlan,
  PlannerData,
  PlanItem,
  WeekPlan,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const string = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const number = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const boolean = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const list = <T>(
  value: unknown,
  normalize: (entry: UnknownRecord) => T | null,
): T[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const normalized = normalize(entry);
        return normalized ? [normalized] : [];
      })
    : [];

const metric = (value: unknown): MetricType =>
  value === "duration" || value === "percent" || value === "checkbox"
    ? value
    : "count";

const requiredString = (value: unknown): string | null => {
  const normalized = string(value).trim();
  return normalized || null;
};

const activity = (entry: UnknownRecord): ActivityType | null => {
  const id = requiredString(entry.id);
  if (!id) return null;
  return {
    id,
    name: string(entry.name, "Без названия"),
    color: string(entry.color, "#47624f"),
    icon: string(entry.icon),
    order: number(entry.order),
    archived: boolean(entry.archived),
  };
};

const direction = (entry: UnknownRecord): Direction | null => {
  const id = requiredString(entry.id);
  if (!id) return null;
  return {
    id,
    name: string(entry.name, "Без названия"),
    metric: metric(entry.metric),
    unit: string(entry.unit),
    color: string(entry.color, "#47624f"),
    availability:
      entry.availability === "paused" || entry.availability === "archived"
        ? entry.availability
        : "active",
    metricHistory: list(entry.metricHistory, (history) => ({
      metric: metric(history.metric),
      unit: string(history.unit),
      since: string(history.since),
    })),
  };
};

const segment = (entry: UnknownRecord): DaySegment | null => {
  const activityId = requiredString(entry.activityId);
  return activityId
    ? { activityId, percent: number(entry.percent) }
    : null;
};

const breakPeriod = (entry: UnknownRecord): BreakPeriod | null => {
  const id = requiredString(entry.id);
  return id
    ? { id, start: string(entry.start), end: string(entry.end) }
    : null;
};

const day = (entry: UnknownRecord): DayPlan | null => {
  const date = requiredString(entry.date);
  if (!date) return null;
  const workStart = string(entry.workStart);
  const workEnd = string(entry.workEnd);
  return {
    date,
    segments: list(entry.segments, segment),
    ...(workStart ? { workStart } : {}),
    ...(workEnd ? { workEnd } : {}),
    breaks: list(entry.breaks, breakPeriod),
  };
};

const planItem = (entry: UnknownRecord): PlanItem | null => {
  const id = requiredString(entry.id);
  const directionId = requiredString(entry.directionId);
  if (!id || !directionId) return null;
  const target = number(entry.target);
  const paused = isRecord(entry.paused)
    ? {
        reason: string(entry.paused.reason),
        ...(string(entry.paused.details) ? { details: string(entry.paused.details) } : {}),
        date: string(entry.paused.date),
        excluded: number(entry.paused.excluded),
      }
    : undefined;
  return {
    id,
    directionId,
    originalTarget: number(entry.originalTarget, target),
    target,
    metric: metric(entry.metric),
    unit: string(entry.unit),
    ...(paused ? { paused } : {}),
    history: list(entry.history, (history) => ({
      date: string(history.date),
      from: number(history.from),
      to: number(history.to),
      reason: string(history.reason),
    })),
  };
};

const month = (entry: UnknownRecord): MonthPlan | null => {
  const id = requiredString(entry.id);
  if (!id) return null;
  return {
    id,
    month: string(entry.month, id),
    items: list(entry.items, planItem),
  };
};

const week = (entry: UnknownRecord): WeekPlan | null => {
  const id = requiredString(entry.id);
  if (!id) return null;
  return {
    id,
    start: string(entry.start, id),
    monthId: string(entry.monthId),
    items: list(entry.items, planItem),
  };
};

const completion = (entry: UnknownRecord): Completion | null => {
  const id = requiredString(entry.id);
  const directionId = requiredString(entry.directionId);
  if (!id || !directionId) return null;
  return {
    id,
    directionId,
    weekId: string(entry.weekId),
    date: string(entry.date),
    value: number(entry.value),
  };
};

const extraResult = (entry: UnknownRecord): ExtraResult | null => {
  const id = requiredString(entry.id);
  if (!id) return null;
  return {
    id,
    weekId: string(entry.weekId),
    title: string(entry.title, "Без названия"),
    metric: metric(entry.metric),
    unit: string(entry.unit),
    value: number(entry.value),
    date: string(entry.date),
  };
};

const settings = (value: unknown): AppSettings => {
  const defaults = createInitialData().settings;
  if (!isRecord(value)) return defaults;
  return {
    timezone: string(value.timezone, defaults.timezone),
    weekStartsOn: "monday",
    timeFormat: value.timeFormat === "12" ? "12" : "24",
    language: "ru",
    scheduleRange:
      value.scheduleRange === 21 || value.scheduleRange === 30
        ? value.scheduleRange
        : 14,
    weekReminder: boolean(value.weekReminder, defaults.weekReminder),
    monthReminder: boolean(value.monthReminder, defaults.monthReminder),
    theme:
      value.theme === "dark" || value.theme === "system"
        ? value.theme
        : "light",
    density: value.density === "compact" ? "compact" : "comfortable",
  };
};

export const normalizePlannerData = (value: unknown): PlannerData | null => {
  if (!isRecord(value) || value.version !== 2) return null;
  return {
    version: 2,
    activityTypes: list(value.activityTypes, activity),
    directions: list(value.directions, direction),
    days: list(value.days, day),
    months: list(value.months, month),
    weeks: list(value.weeks, week),
    completions: list(value.completions, completion),
    extraResults: list(value.extraResults, extraResult),
    settings: settings(value.settings),
  };
};
