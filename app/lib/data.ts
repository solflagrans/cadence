import type { PlannerData, MetricType, PlanItem } from "./types";

export const uid = (prefix = "id") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const iso = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

export const parseDate = (value: string) => new Date(`${value}T12:00:00`);

export const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(12, 0, 0, 0);
  return copy;
};

export const weekIdFor = (date: Date) => iso(startOfWeek(date));

export const monthIdForWeek = (weekStart: string) => {
  const thursday = addDays(parseDate(weekStart), 3);
  return iso(thursday).slice(0, 7);
};

export const monthName = (id: string) =>
  new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(
    parseDate(`${id}-01`),
  );

export const dateLabel = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ru-RU", options ?? { day: "numeric", month: "long" }).format(
    parseDate(value),
  );

export const weekLabel = (start: string) => {
  const first = parseDate(start);
  const last = addDays(first, 6);
  const firstLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: first.getMonth() === last.getMonth() ? undefined : "short",
  }).format(first);
  const lastLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    last,
  );
  return `${firstLabel}–${lastLabel}`;
};

export const metricName: Record<MetricType, string> = {
  count: "Количество",
  duration: "Длительность",
  percent: "Процент",
  checkbox: "Отметка",
};

export const formatValue = (value: number, metric: MetricType, unit: string) => {
  if (metric === "checkbox") return value >= 1 ? "Выполнено" : "Не выполнено";
  if (metric === "percent") return `${value}%`;
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)} ${unit}`;
};

export const itemFact = (data: PlannerData, item: PlanItem, weekId?: string) => {
  const entries = data.completions.filter(
    (entry) =>
      entry.directionId === item.directionId &&
      (weekId ? entry.weekId === weekId : monthIdForWeek(entry.weekId) === data.months.find((m) => m.items.some((i) => i.id === item.id))?.id),
  );
  if (!entries.length) return 0;
  if (item.metric === "percent") return entries.sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.value ?? 0;
  if (item.metric === "checkbox") return entries.some((entry) => entry.value >= 1) ? 1 : 0;
  return entries.reduce((sum, entry) => sum + entry.value, 0);
};

export const progress = (fact: number, target: number, metric: MetricType) => {
  if (metric === "checkbox") return fact >= 1 ? 100 : 0;
  return target > 0 ? Math.min(100, Math.round((fact / target) * 100)) : 0;
};

export const createInitialData = (): PlannerData => ({
  version: 2,
  activityTypes: [],
  directions: [],
  days: [],
  months: [],
  weeks: [],
  completions: [],
  extraResults: [],
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
