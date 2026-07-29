import type { PlannerData } from "../model/types";

export const clearWorkPeriod = (
  state: PlannerData,
  date: string,
  clearBreaks: boolean,
): PlannerData => ({
  ...state,
  days: state.days.map((day) => {
    if (day.date !== date) return day;
    const next = { ...day };
    delete next.workStart;
    delete next.workEnd;
    if (clearBreaks) next.breaks = [];
    return next;
  }),
});
