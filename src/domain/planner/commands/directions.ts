import type { Direction, PlannerData } from "../model/types";

export const addDirection = (
  state: PlannerData,
  direction: Direction,
): PlannerData => ({
  ...state,
  directions: [...state.directions, direction],
});

export const updateDirection = (
  state: PlannerData,
  direction: Direction,
): PlannerData => ({
  ...state,
  directions: state.directions.map((item) =>
    item.id === direction.id ? direction : item,
  ),
});

export const deleteDirection = (
  state: PlannerData,
  directionId: string,
): PlannerData => {
  const months = state.months.flatMap((month) => {
    const items = month.items.filter(
      (item) => item.directionId !== directionId,
    );
    return items.length ? [{ ...month, items }] : [];
  });
  const weeks = state.weeks.flatMap((week) => {
    const items = week.items.filter(
      (item) => item.directionId !== directionId,
    );
    return items.length ? [{ ...week, items }] : [];
  });
  return {
    ...state,
    directions: state.directions.filter((item) => item.id !== directionId),
    months,
    weeks,
    completions: state.completions.filter(
      (completion) => completion.directionId !== directionId,
    ),
  };
};

export const archiveDirection = (
  state: PlannerData,
  directionId: string,
): PlannerData => ({
  ...state,
  directions: state.directions.map((direction) =>
    direction.id === directionId
      ? { ...direction, availability: "archived" }
      : direction,
  ),
});

export const restoreDirection = (
  state: PlannerData,
  directionId: string,
): PlannerData => ({
  ...state,
  directions: state.directions.map((direction) =>
    direction.id === directionId
      ? { ...direction, availability: "active" }
      : direction,
  ),
});

export const directionDeletionImpact = (
  state: PlannerData,
  directionId: string,
) => ({
  months: state.months.filter((month) =>
    month.items.some((item) => item.directionId === directionId),
  ).length,
  weeks: state.weeks.filter((week) =>
    week.items.some((item) => item.directionId === directionId),
  ).length,
  completions: state.completions.filter(
    (completion) => completion.directionId === directionId,
  ).length,
});

export const isDirectionMetricUsed = (
  state: PlannerData,
  directionId: string,
) =>
  state.months.some((month) =>
    month.items.some((item) => item.directionId === directionId),
  ) ||
  state.weeks.some((week) =>
    week.items.some((item) => item.directionId === directionId),
  ) ||
  state.completions.some(
    (completion) => completion.directionId === directionId,
  );
