import { expect, it } from "vitest";
import { monthTitle, readTarget, shiftMonth } from "@/src/modules/monthly-plans/ui/format";

it("navigates calendar years within supported boundaries", () => {
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  expect(shiftMonth("0001-01", -1)).toBe("0001-01");
  expect(shiftMonth("9999-12", 1)).toBe("9999-12");
  expect(monthTitle("2026-09")).toBe("Сентябрь 2026");
});
it("validates time fields and preserves exact decimal volume", () => {
  expect(readTarget("time", "1", "30", "")).toEqual({ kind: "time", minutes: 90 });
  expect(() => readTarget("time", "1", "60", "")).toThrow();
  expect(() => readTarget("time", "1.5", "", "")).toThrow();
  expect(() => readTarget("time", "", "", "")).toThrow();
  expect(readTarget("volume", "", "", "12,500")).toEqual({ kind: "volume", amount: "12.5" });
});
