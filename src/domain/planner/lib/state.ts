import type {
  MonthPlan,
  PlannerData,
  PlanItem,
  WeekPlan,
} from "../model/types";

export const hasPlannerContent = (data: PlannerData): boolean =>
  data.directions.length > 0 ||
  data.activityTypes.length > 0 ||
  data.days.length > 0 ||
  data.months.length > 0 ||
  data.weeks.length > 0 ||
  data.completions.length > 0 ||
  data.extraResults.length > 0 ||
  data.reviews.length > 0;

const mergeBy = <T>(
  guest: T[],
  account: T[],
  key: (item: T) => string,
): T[] => {
  const result = new Map<string, T>();
  guest.forEach((item) => result.set(key(item), item));
  account.forEach((item) => result.set(key(item), item));
  return [...result.values()];
};

const mergePlanItems = (
  guest: PlanItem[],
  account: PlanItem[],
): PlanItem[] => mergeBy(guest, account, (item) => item.directionId);

const mergeMonths = (
  guest: MonthPlan[],
  account: MonthPlan[],
): MonthPlan[] => {
  const guestById = new Map(guest.map((plan) => [plan.id, plan]));
  return mergeBy(guest, account, (plan) => plan.id).map((plan) => {
    const guestPlan = guestById.get(plan.id);
    return guestPlan && account.some((item) => item.id === plan.id)
      ? { ...plan, items: mergePlanItems(guestPlan.items, plan.items) }
      : plan;
  });
};

const mergeWeeks = (
  guest: WeekPlan[],
  account: WeekPlan[],
): WeekPlan[] => {
  const guestById = new Map(guest.map((plan) => [plan.id, plan]));
  return mergeBy(guest, account, (plan) => plan.id).map((plan) => {
    const guestPlan = guestById.get(plan.id);
    return guestPlan && account.some((item) => item.id === plan.id)
      ? { ...plan, items: mergePlanItems(guestPlan.items, plan.items) }
      : plan;
  });
};

export const mergePlannerData = (
  account: PlannerData,
  guest: PlannerData,
): PlannerData => ({
  ...account,
  activityTypes: mergeBy(
    guest.activityTypes,
    account.activityTypes,
    (item) => item.id,
  ),
  directions: mergeBy(
    guest.directions,
    account.directions,
    (item) => item.id,
  ),
  days: mergeBy(guest.days, account.days, (item) => item.date),
  months: mergeMonths(guest.months, account.months),
  weeks: mergeWeeks(guest.weeks, account.weeks),
  completions: mergeBy(
    guest.completions,
    account.completions,
    (item) => item.id,
  ),
  extraResults: mergeBy(
    guest.extraResults,
    account.extraResults,
    (item) => item.id,
  ),
  reviews: mergeBy(guest.reviews, account.reviews, (item) => item.id),
});

export const plannerContentSummary = (data: PlannerData) => ({
  directions: data.directions.filter(
    (item) => item.availability !== "archived",
  ).length,
  months: data.months.length,
  weeks: data.weeks.length,
  completions: data.completions.length,
});
