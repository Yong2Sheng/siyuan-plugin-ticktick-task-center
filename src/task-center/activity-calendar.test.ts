import { describe, expect, it } from "vitest";

import type { TaskCenterItem } from "./task-center-data";
import { countTaskCenterActivityByDate, getActivityHeatLevel } from "./activity-calendar";

function item(overrides: Partial<TaskCenterItem> = {}): TaskCenterItem {
    return {
        blockId: "20260908120000-abcdefg",
        rootId: "20260908110000-hijklmn",
        documentTitle: "Research",
        documentFilePath: "/20260908110000-hijklmn.sy",
        documentPath: "/Research",
        title: "Task",
        url: "https://ticktick.com/task/example",
        status: "in-progress",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-08T10:00:00.000Z",
        ...overrides,
    };
}

describe("task center activity calendar", () => {
    it.each([
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 3],
        [5, 4],
        [20, 4],
    ] as const)("maps %i actual tasks to heat level %i", (actual, expected) => {
        expect(getActivityHeatLevel(actual)).toBe(expected);
    });

    it("counts explicit focus plans and every task progressed on a date", () => {
        const counts = countTaskCenterActivityByDate([
            item({
                focusPlan: {
                    version: 1,
                    entries: [
                        { date: "2026-09-07", plannedAt: "2026-09-06T10:00:00.000Z", completedOn: "2026-09-08" },
                        { date: "2026-09-09", plannedAt: "2026-09-06T10:01:00.000Z" },
                    ],
                },
                progressLog: { version: 1, dates: ["2026-09-08"] },
            }),
            item({
                blockId: "20260908120001-opqrstu",
                lastProgressedDate: "2026-09-08",
            }),
        ], "2026-09-08");

        expect(counts.get("2026-09-07")).toEqual({ planned: 1, actual: 0 });
        expect(counts.get("2026-09-08")).toEqual({ planned: 0, actual: 2 });
        expect(counts.get("2026-09-09")).toEqual({ planned: 1, actual: 0 });
    });

    it("does not count a closed task as future workload but retains its past plan", () => {
        const counts = countTaskCenterActivityByDate([item({
            status: "completed",
            focusPlan: {
                version: 1,
                entries: [
                    { date: "2026-09-07", plannedAt: "2026-09-01T10:00:00.000Z" },
                    { date: "2026-09-09", plannedAt: "2026-09-01T10:01:00.000Z" },
                ],
            },
        })], "2026-09-08");

        expect(counts.get("2026-09-07")?.planned).toBe(1);
        expect(counts.get("2026-09-09")).toBeUndefined();
    });
});
