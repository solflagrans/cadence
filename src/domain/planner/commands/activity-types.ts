import type { PlannerData } from "../model/types";
import { normalizePercentValues } from "../lib/percentages";

export const archiveActivityType = (
  state: PlannerData,
  activityId: string,
): PlannerData => ({
  ...state,
  activityTypes: state.activityTypes.map((activity) =>
    activity.id === activityId ? { ...activity, archived: true } : activity,
  ),
});

export const restoreActivityType = (
  state: PlannerData,
  activityId: string,
): PlannerData => ({
  ...state,
  activityTypes: state.activityTypes.map((activity) =>
    activity.id === activityId ? { ...activity, archived: false } : activity,
  ),
});

export const deleteActivityType = (
  state: PlannerData,
  activityId: string,
): PlannerData => ({
  ...state,
  activityTypes: state.activityTypes.filter(
    (activity) => activity.id !== activityId,
  ),
  days: state.days.map((day) => {
    const segments = day.segments.filter(
      (segment) => segment.activityId !== activityId,
    );
    if (!segments.length) return { ...day, segments: [] };
    const normalized = normalizePercentValues(
      segments.map((segment) => segment.percent),
    );
    return {
      ...day,
      segments: segments.map((segment, index) => ({
        ...segment,
        percent: normalized[index],
      })),
    };
  }),
});
