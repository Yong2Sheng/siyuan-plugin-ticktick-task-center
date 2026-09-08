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

    it("writes and verifies the progress attribute and clears it with an empty value", async () => {
        let attributes: Record<string, unknown> = {};
        const loadAttributes = vi.fn().mockImplementation(async () => ({ ...attributes }));
        const setBlockAttributes = vi.fn().mockImplementation(async (_blockId, next) => {
            attributes = { ...attributes, ...next };
        });
        const api = { loadAttributes, setBlockAttributes };

        await saveDailyProgress(api, "20260713120000-abcdefg", "2026-08-11", "2026-08-11");
        await saveDailyProgress(api, "20260713120000-abcdefg", undefined, "2026-08-11");

        expect(setBlockAttributes).toHaveBeenNthCalledWith(1, "20260713120000-abcdefg", {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate]: "2026-08-11",
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog]: JSON.stringify({
                version: 1,
                dates: ["2026-08-11"],
            }),
        });
        expect(setBlockAttributes).toHaveBeenNthCalledWith(2, "20260713120000-abcdefg", {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate]: "",
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog]: "",
        });
        expect(loadAttributes).toHaveBeenCalledTimes(4);
    });

    it("preserves legacy and earlier progress dates when marking and undoing today", async () => {
        let attributes: Record<string, unknown> = {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate]: "2026-08-10",
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog]: JSON.stringify({
                version: 1,
                dates: ["2026-08-09"],
            }),
        };
        const api = {
            loadAttributes: vi.fn().mockImplementation(async () => ({ ...attributes })),
            setBlockAttributes: vi.fn().mockImplementation(async (_blockId, next) => {
                attributes = { ...attributes, ...next };
            }),
        };

        await saveDailyProgress(api, "20260713120000-abcdefg", "2026-08-11", "2026-08-11");
        expect(JSON.parse(String(attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog])).dates)
            .toEqual(["2026-08-09", "2026-08-10", "2026-08-11"]);

        await saveDailyProgress(api, "20260713120000-abcdefg", undefined, "2026-08-11");
        expect(JSON.parse(String(attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog])).dates)
            .toEqual(["2026-08-09", "2026-08-10"]);
    });

    it("fulfils due focus dates with progress and reopens them when progress is undone", async () => {
        const blockId = "20260713120000-abcdefg";
        let attributes: Record<string, unknown> = {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan]: JSON.stringify({
                version: 1,
                entries: [
                    { date: "2026-08-10", plannedAt: "2026-08-09T20:00:00.000Z" },
                    { date: "2026-08-12", plannedAt: "2026-08-09T20:01:00.000Z" },
                ],
            }),
        };
        const api = {
            loadAttributes: vi.fn().mockImplementation(async () => ({ ...attributes })),
            setBlockAttributes: vi.fn().mockImplementation(async (_id, next) => {
                attributes = { ...attributes, ...next };
            }),
        };

        const progressed = await saveDailyProgress(api, blockId, "2026-08-11", "2026-08-11");
        expect(progressed.focusPlan?.entries).toEqual([
            expect.objectContaining({ date: "2026-08-10", completedOn: "2026-08-11" }),
            expect.not.objectContaining({ completedOn: expect.anything() }),
        ]);

        const reopened = await saveDailyProgress(api, blockId, undefined, "2026-08-11");
        expect(reopened.focusPlan?.entries[0]).not.toHaveProperty("completedOn");
    });

    it("rejects a progress write that cannot be verified", async () => {
        const api = {
            loadAttributes: vi.fn()
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({}),
            setBlockAttributes: vi.fn().mockResolvedValue(undefined),
        };
        await expect(saveDailyProgress(
            api,
            "20260713120000-abcdefg",
            "2026-08-11",
            "2026-08-11",
        )).rejects.toThrow("Daily progress verification failed");
    });

    it("schedules the next view reset just after local midnight", () => {
        const now = new Date(2026, 7, 11, 23, 59, 59, 900);
        expect(millisecondsUntilNextLocalDay(now)).toBe(150);
    });
});
