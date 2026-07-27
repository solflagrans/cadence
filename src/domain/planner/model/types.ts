export type MetricType = "count" | "duration" | "percent" | "checkbox";

export type ActivityType = {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  archived: boolean;
};

export type Direction = {
  id: string;
  name: string;
  metric: MetricType;
  unit: string;
  color: string;
  availability: "active" | "paused" | "archived";
  metricHistory: { metric: MetricType; unit: string; since: string }[];
};

export type DaySegment = { activityId: string; percent: number };
export type BreakPeriod = { id: string; start: string; end: string };
export type DayPlan = {
  date: string;
  segments: DaySegment[];
  workStart?: string;
  workEnd?: string;
  breaks: BreakPeriod[];
};

export type PlanItem = {
  id: string;
  directionId: string;
  originalTarget: number;
  target: number;
  metric: MetricType;
  unit: string;
  paused?: {
    reason: string;
    details?: string;
    date: string;
    excluded: number;
  };
  history: { date: string; from: number; to: number; reason: string }[];
};

export type Completion = {
  id: string;
  directionId: string;
  weekId: string;
  date: string;
  value: number;
};

export type ExtraResult = {
  id: string;
  weekId: string;
  title: string;
  metric: MetricType;
  unit: string;
  value: number;
  date: string;
};

export type MonthPlan = {
  id: string;
  month: string;
  items: PlanItem[];
};

export type WeekPlan = {
  id: string;
  start: string;
  monthId: string;
  items: PlanItem[];
};

export type AppSettings = {
  timezone: string;
  weekStartsOn: "monday";
  timeFormat: "24" | "12";
  language: "ru";
  scheduleRange: 14 | 21 | 30;
  weekReminder: boolean;
  monthReminder: boolean;
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
};

export type PlannerData = {
  version: 2;
  activityTypes: ActivityType[];
  directions: Direction[];
  days: DayPlan[];
  months: MonthPlan[];
  weeks: WeekPlan[];
  completions: Completion[];
  extraResults: ExtraResult[];
  settings: AppSettings;
};
