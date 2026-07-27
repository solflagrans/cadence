import type {
  ActivityType,
  Direction,
} from "@/src/domain/planner/model/types";

export type ModalState =
  | {
      kind: "direction";
      direction?: Direction;
      returnToPlan?: { scope: "month" | "week"; id: string };
    }
  | { kind: "activity"; activity?: ActivityType }
  | { kind: "day"; date: string }
  | { kind: "work"; date: string }
  | {
      kind: "fact";
      weekId: string;
      directionId?: string;
      completionId?: string;
    }
  | { kind: "extra"; weekId: string; resultId?: string }
  | { kind: "month-plan"; monthId: string }
  | { kind: "week-plan"; weekId: string }
  | {
      kind: "edit-item";
      scope: "month" | "week";
      planId: string;
      itemId: string;
    }
  | {
      kind: "pause";
      scope: "month" | "week";
      planId: string;
      itemId: string;
      returnToEdit?: boolean;
    }
  | {
      kind: "details";
      scope: "month" | "week";
      planId: string;
      itemId: string;
      returnToEdit?: boolean;
    }
  | { kind: "confirm-reset" }
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      tone?: "primary" | "danger";
      onConfirm: () => void;
      returnTo?: Exclude<ModalState, null>;
    }
  | null;
