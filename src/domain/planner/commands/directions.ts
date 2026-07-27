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
): PlannerData => ({
  ...state,
  directions: state.directions.filter((item) => item.id !== directionId),
  months: state.months.map((month) => ({
    ...month,
    items: month.items.filter((item) => item.directionId !== directionId),
  })),
  weeks: state.weeks.map((week) => ({
    ...week,
    items: week.items.filter((item) => item.directionId !== directionId),
  })),
  completions: state.completions.filter(
    (completion) => completion.directionId !== directionId,
  ),
});

export const moveDirectionToTrash = (
  state: PlannerData,
  directionId: string,
  deletedAt: string,
): PlannerData => ({
  ...state,
  directions: state.directions.map((direction) =>
    direction.id === directionId ? { ...direction, deletedAt } : direction,
  ),
});

export const restoreDirection = (
  state: PlannerData,
  directionId: string,
): PlannerData => ({
  ...state,
  directions: state.directions.map((direction) => {
    if (direction.id !== directionId) return direction;
    const restored = { ...direction };
    delete restored.deletedAt;
    return restored;
  }),
});
