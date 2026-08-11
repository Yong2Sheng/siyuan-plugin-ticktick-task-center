import { describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
import {
    getLocalDate,
    isProgressedToday,
    millisecondsUntilNextLocalDay,
    readLocalDate,
    saveDailyProgress,
} from "./daily-progress";

describe("daily task progress", () => {
    it("formats a calendar date from the runtime local timezone", () => {
        expect(getLocalDate(new Date(2026, 7, 11, 23, 30))).toBe("2026-08-11");
        expect(getLocalDate(new Date(2026, 7, 12, 0, 30))).toBe("2026-08-12");
    });

    it("accepts real local date keys and ignores missing or malformed optional values", () => {
        expect(readLocalDate("2026-08-11")).toBe("2026-08-11");
        expect(readLocalDate("2026-02-29")).toBeUndefined();
        expect(readLocalDate("2026-8-11")).toBeUndefined();
        expect(readLocalDate(20260811)).toBeUndefined();
    });

    it("derives today's state without resetting persisted attributes", () => {
        expect(isProgressedToday("2026-08-11", "2026-08-11")).toBe(true);
        expect(isProgressedToday("2026-08-11", "2026-08-12")).toBe(false);
        expect(isProgressedToday(undefined, "2026-08-12")).toBe(false);
    });

    it("writes only the optional progress attribute and clears it with an empty value", async () => {
        const setBlockAttributes = vi.fn().mockResolvedValue(undefined);
        const api = { setBlockAttributes };

        await saveDailyProgress(api, "20260713120000-abcdefg", "2026-08-11");
        await saveDailyProgress(api, "20260713120000-abcdefg", undefined);

        expect(setBlockAttributes).toHaveBeenNthCalledWith(1, "20260713120000-abcdefg", {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate]: "2026-08-11",
        });
        expect(setBlockAttributes).toHaveBeenNthCalledWith(2, "20260713120000-abcdefg", {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate]: "",
        });
    });

    it("schedules the next view reset just after local midnight", () => {
        const now = new Date(2026, 7, 11, 23, 59, 59, 900);
        expect(millisecondsUntilNextLocalDay(now)).toBe(150);
    });
});
