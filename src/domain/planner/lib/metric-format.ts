import type {
  MetricType,
  ValueFormat,
} from "../model/types";

export const defaultMetricFormat = (
  metric: MetricType,
  unit: string,
): { valueFormat: ValueFormat; decimalPlaces: number } => {
  if (metric === "percent") {
    return { valueFormat: "decimal", decimalPlaces: 1 };
  }
  if (metric === "duration" && unit === "ч.") {
    return { valueFormat: "decimal", decimalPlaces: 2 };
  }
  return { valueFormat: "integer", decimalPlaces: 0 };
};

export const normalizeDecimalPlaces = (
  valueFormat: ValueFormat,
  decimalPlaces: number,
) =>
  valueFormat === "integer"
    ? 0
    : Math.max(1, Math.min(2, Math.round(decimalPlaces || 1)));

