import { describe, expect, it } from "vitest";

import { addLocalCalendarDays } from "./local-date";

describe("local calendar date arithmetic", () => {
    it.each([
        ["2026-08-31", 1, "2026-09-01"],
        ["2026-12-31", 1, "2027-01-01"],
        ["2028-02-28", 1, "2028-02-29"],
        ["2026-03-01", -1, "2026-02-28"],
    ])("adds calendar days across boundaries", (date, days, expected) => {
        expect(addLocalCalendarDays(date, days)).toBe(expected);
    });

    it("rejects malformed dates and fractional day offsets", () => {
        expect(addLocalCalendarDays("2026-02-31", 1)).toBeUndefined();
        expect(addLocalCalendarDays("2026-08-31", 0.5)).toBeUndefined();
    });
});
