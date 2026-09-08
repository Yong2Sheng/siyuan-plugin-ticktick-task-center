import { describe, expect, it } from "vitest";

import {
    calendarMonthFromDate,
    formatCalendarMonthKey,
    getCalendarMonthCells,
    shiftCalendarMonth,
} from "./calendar-month";

describe("calendar month", () => {
    it("builds a Monday-first leap-year month", () => {
        const month = calendarMonthFromDate("2028-02-10")!;
        const cells = getCalendarMonthCells(month);
        expect(cells).toHaveLength(35);
        expect(cells[0]).toBeUndefined();
        expect(cells[1]).toBe("2028-02-01");
        expect(cells).toContain("2028-02-29");
    });

    it("moves across year boundaries and formats a stable month key", () => {
        const shifted = shiftCalendarMonth({ year: 2026, month: 12 }, 1);
        expect(shifted).toEqual({ year: 2027, month: 1 });
        expect(formatCalendarMonthKey(shifted!)).toBe("2027-01");
    });

    it("rejects invalid dates, months, and fractional offsets", () => {
        expect(calendarMonthFromDate("2026-02-31")).toBeUndefined();
        expect(getCalendarMonthCells({ year: 2026, month: 13 })).toEqual([]);
        expect(shiftCalendarMonth({ year: 2026, month: 1 }, 0.5)).toBeUndefined();
    });
});
