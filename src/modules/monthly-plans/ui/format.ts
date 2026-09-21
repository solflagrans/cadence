import type { Metric } from "@/src/modules/priorities/domain/priority";
import { targetSchema, type Target } from "../domain/monthly-plan";

export function localMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export function shiftMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  const index = year * 12 + number - 1 + delta;
  if (index < 12 || index > 119999) return month;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
}
export function monthTitle(month: string) {
  const [year, number] = month.split("-").map(Number);
  const names = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  return `${names[number - 1]} ${year}`;
}
export function formatTarget(target: Target, metric: Metric) {
  if (target.kind === "time") {
    const hours = Math.floor(target.minutes / 60);
    const minutes = target.minutes % 60;
    return [hours ? `${hours} ч` : "", minutes ? `${minutes} мин` : ""].filter(Boolean).join(" ");
  }
  return `${String(target.amount).replace(".", ",")} ${metric.kind === "time" ? "" : metric.unit}`.trim();
}
export function readTarget(kind: Metric["kind"], hours: string, minutes: string, amount: string): Target {
  if (kind === "time") {
    if (!/^\d*$/.test(hours) || !/^\d*$/.test(minutes) || Number(minutes) > 59) throw new Error("Минуты: от 0 до 59. Часы — целое число.");
    const parsed = targetSchema.safeParse({ kind, minutes: Number(hours) * 60 + Number(minutes) });
    if (!parsed.success) throw new Error("Укажите время больше нуля.");
    return parsed.data;
  }
  if (kind === "quantity" && !/^\d+$/.test(amount)) throw new Error("Введите целое число.");
  const parsed = targetSchema.safeParse({ kind, amount: kind === "quantity" ? Number(amount) : amount });
  if (!parsed.success) throw new Error(kind === "quantity" ? "Укажите количество от 1 до 2 147 483 647." : "Укажите объём от 0,001 до 999 999 999,999.");
  return parsed.data;
}
