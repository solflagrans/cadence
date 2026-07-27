import type {
  Completion,
  MonthPlan,
  PlannerData,
  WeekPlan,
} from "../model/types";

export const saveMonthPlan = (
  state: PlannerData,
  plan: MonthPlan,
): PlannerData => ({
  ...state,
  months: state.months.some((item) => item.id === plan.id)
    ? state.months.map((item) => (item.id === plan.id ? plan : item))
    : [...state.months, plan],
});

export const saveWeekPlan = (
  state: PlannerData,
  plan: WeekPlan,
): PlannerData => ({
  ...state,
  weeks: state.weeks.some((item) => item.id === plan.id)
    ? state.weeks.map((item) => (item.id === plan.id ? plan : item))
    : [...state.weeks, plan],
});

export const recordCompletion = (
  state: PlannerData,
  completion: Completion,
): PlannerData => ({
  ...state,
  completions: [...state.completions, completion],
});
