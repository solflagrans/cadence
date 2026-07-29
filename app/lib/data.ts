import type { MetricType } from "@/src/domain/planner/model/types";

export { createInitialData } from "@/src/domain/planner/model/defaults";
export {
  addDays,
  iso,
  monthIdForWeek,
  parseDate,
  startOfWeek,
  weekIdFor,
} from "@/src/domain/planner/lib/dates";
export { itemFact, progress } from "@/src/domain/planner/lib/progress";

import {
  addDays,
  parseDate,
} from "@/src/domain/planner/lib/dates";

export const uid = (prefix = "id") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const pluralize = (
  value: number,
  forms: [string, string, string],
) => {
  const absolute = Math.abs(value) % 100;
  const last = absolute % 10;
  if (absolute > 10 && absolute < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
};

export const monthName = (id: string) => {
  const value = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  })
    .format(parseDate(`${id}-01`))
    .replace(/\s+г\.$/u, "");
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const dateLabel = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat(
    "ru-RU",
    options ?? { day: "numeric", month: "long" },
  ).format(parseDate(value));

export const weekLabel = (start: string) => {
  const first = parseDate(start);
  const last = addDays(first, 6);
  const firstLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(first);
  const lastLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(last);
  return `${firstLabel} – ${lastLabel}`;
};

export const metricName: Record<MetricType, string> = {
  count: "Количество",
  duration: "Длительность",
  percent: "Процент",
  checkbox: "Отметка",
};

export const formatValue = (
  value: number,
  metric: MetricType,
  unit: string,
) => {
  if (metric === "checkbox") {
    return value >= 1 ? "Выполнено" : "Не выполнено";
  }
  if (metric === "percent") return `${value}%`;
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value)} ${unit}`;
};
