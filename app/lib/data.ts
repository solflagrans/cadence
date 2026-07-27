import type { PlannerData, MetricType, PlanItem, DayPlan } from "./types";

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

const plan = (
  id: string,
  directionId: string,
  target: number,
  metric: MetricType,
  unit: string,
  paused?: PlanItem["paused"],
): PlanItem => ({
  id,
  directionId,
  originalTarget: paused ? target + paused.excluded : target,
  target,
  metric,
  unit,
  paused,
  history: paused
    ? [{ date: paused.date, from: target + paused.excluded, to: target, reason: paused.reason }]
    : [],
});

const schedulePattern: DayPlan["segments"][] = [
  [{ activityId: "employment", percent: 100 }],
  [{ activityId: "projects", percent: 100 }],
  [{ activityId: "employment", percent: 100 }],
  [{ activityId: "projects", percent: 100 }],
  [
    { activityId: "employment", percent: 50 },
    { activityId: "rest", percent: 50 },
  ],
  [{ activityId: "projects", percent: 100 }],
  [{ activityId: "rest", percent: 100 }],
];

export const createDemoData = (): PlannerData => {
  const days: DayPlan[] = [];
  const from = parseDate("2026-06-29");
  for (let index = 0; index < 42; index += 1) {
    const date = addDays(from, index);
    const segments = schedulePattern[index % 7].map((segment) => ({ ...segment }));
    const projectDay = segments.some((segment) => segment.activityId === "projects");
    days.push({
      date: iso(date),
      segments,
      workStart: projectDay ? "12:30" : undefined,
      workEnd: projectDay ? "22:30" : undefined,
      breaks: projectDay
        ? [
            { id: uid("break"), start: "17:00", end: "17:30" },
            { id: uid("break"), start: "20:00", end: "20:15" },
          ]
        : [],
    });
  }

  const monthItems = [
    plan("m-boyars", "boyars", 35, "duration", "ч"),
    plan("m-speech", "speech", 15, "count", "занятий"),
    plan("m-vocal", "vocal", 15, "count", "занятий"),
    plan("m-tg", "telegram", 4, "count", "поста"),
    plan("m-smm", "smm", 4, "count", "поста"),
    plan("m-cleaning", "cleaning", 2, "count", "раза"),
    plan("m-resume", "resume", 1, "checkbox", ""),
  ];
  const weekItems = [
    plan("w-boyars", "boyars", 12, "duration", "ч"),
    plan("w-speech", "speech", 1, "count", "занятие", {
      reason: "Болезнь",
      date: "2026-07-16",
      excluded: 2,
    }),
    plan("w-tg", "telegram", 1, "count", "пост"),
    plan("w-smm", "smm", 1, "count", "пост"),
    plan("w-resume", "resume", 1, "checkbox", ""),
  ];
  const currentWeekItems = [
    plan("cw-boyars", "boyars", 10, "duration", "ч"),
    plan("cw-vocal", "vocal", 3, "count", "занятия"),
    plan("cw-tg", "telegram", 1, "count", "пост"),
    plan("cw-cleaning", "cleaning", 1, "count", "раз"),
  ];

  return {
    version: 1,
    activityTypes: [
      { id: "employment", name: "Работа в найме", color: "#52a675", icon: "briefcase", order: 1, archived: false },
      { id: "projects", name: "Работа над проектами", color: "#5278d9", icon: "layers", order: 2, archived: false },
      { id: "rest", name: "Отдых", color: "#8b6cc8", icon: "moon", order: 3, archived: false },
    ],
    directions: [
      { id: "boyars", name: "Проект Boyars", metric: "duration", unit: "ч", color: "#5278d9", availability: "active", metricHistory: [{ metric: "duration", unit: "ч", since: "2026-01" }] },
      { id: "speech", name: "Речь", metric: "count", unit: "занятий", color: "#db7a57", availability: "active", metricHistory: [{ metric: "count", unit: "занятий", since: "2026-01" }] },
      { id: "vocal", name: "Вокал", metric: "count", unit: "занятий", color: "#9a6bc5", availability: "active", metricHistory: [{ metric: "count", unit: "занятий", since: "2026-01" }] },
      { id: "telegram", name: "ТГ-канал", metric: "count", unit: "постов", color: "#43a2b5", availability: "active", metricHistory: [{ metric: "count", unit: "постов", since: "2026-01" }] },
      { id: "smm", name: "СММ", metric: "count", unit: "постов", color: "#c18f3f", availability: "active", metricHistory: [{ metric: "count", unit: "постов", since: "2026-01" }] },
      { id: "cleaning", name: "Уборка", metric: "count", unit: "раз", color: "#4c9b8c", availability: "active", metricHistory: [{ metric: "count", unit: "раз", since: "2026-01" }] },
      { id: "resume", name: "Резюме", metric: "checkbox", unit: "", color: "#74808c", availability: "active", metricHistory: [{ metric: "checkbox", unit: "", since: "2026-01" }] },
    ],
    days,
    months: [{ id: "2026-07", month: "2026-07", items: monthItems }],
    weeks: [
      { id: "2026-07-13", start: "2026-07-13", monthId: "2026-07", items: weekItems },
      { id: "2026-07-20", start: "2026-07-20", monthId: "2026-07", items: currentWeekItems },
    ],
    completions: [
      { id: "c1", directionId: "boyars", weekId: "2026-07-13", date: "2026-07-14", value: 5.2 },
      { id: "c2", directionId: "boyars", weekId: "2026-07-13", date: "2026-07-16", value: 5 },
      { id: "c3", directionId: "speech", weekId: "2026-07-13", date: "2026-07-15", value: 1 },
      { id: "c4", directionId: "smm", weekId: "2026-07-13", date: "2026-07-17", value: 1 },
      { id: "c5", directionId: "resume", weekId: "2026-07-13", date: "2026-07-17", value: 1 },
      { id: "c6", directionId: "vocal", weekId: "2026-07-06", date: "2026-07-08", value: 9 },
      { id: "c7", directionId: "telegram", weekId: "2026-07-06", date: "2026-07-09", value: 2 },
      { id: "c8", directionId: "cleaning", weekId: "2026-07-06", date: "2026-07-10", value: 1 },
      { id: "c9", directionId: "boyars", weekId: "2026-07-20", date: "2026-07-21", value: 4.5 },
      { id: "c10", directionId: "boyars", weekId: "2026-07-20", date: "2026-07-24", value: 3.2 },
      { id: "c11", directionId: "vocal", weekId: "2026-07-20", date: "2026-07-22", value: 2 },
      { id: "c12", directionId: "telegram", weekId: "2026-07-20", date: "2026-07-23", value: 1 },
    ],
    extraResults: [
      { id: "e1", weekId: "2026-07-13", title: "Подготовлен квартальный отчёт", metric: "checkbox", unit: "", value: 1, date: "2026-07-14" },
      { id: "e2", weekId: "2026-07-13", title: "Оформлен брендбук", metric: "checkbox", unit: "", value: 1, date: "2026-07-16" },
      { id: "e3", weekId: "2026-07-13", title: "Выполнено учебное задание", metric: "checkbox", unit: "", value: 1, date: "2026-07-17" },
    ],
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
  };
};
