import { describe, expect, it } from "vitest";

import type { TickTickTaskStatus } from "../domain/status";
import type { Translate } from "../i18n";
import type { TaskCenterItem } from "./task-center-data";
import {
    countTaskCenterItems,
    DEFAULT_TASK_CENTER_FILTER,
    filterTaskCenterItems,
    sortTaskCenterItems,
    sortTaskCenterFocusItems,
    sortTaskCenterItemsByDeadline,
} from "./task-center-filter";

const labels: Record<string, string> = {
    "status.todo": "To do",
    "status.inProgress": "In progress",
    "status.waiting": "Waiting for response",
    "status.blocked": "Blocked",
    "status.completed": "Completed",
    "status.failed": "Failed",
    "status.cancelled": "Cancelled",
};
const translate: Translate = (key) => labels[key] ?? key;

function item(
    status: TickTickTaskStatus,
    title: string,
    updatedAt: string,
    blockId: string,
): TaskCenterItem {
    return {
        blockId,
        rootId: "20260713110000-hijklmn",
        documentTitle: title === "DS9 Adaptor" ? "Photozpy" : "Meeting Notes",
        documentFilePath: `/${blockId}.sy`,
        documentPath: title === "DS9 Adaptor" ? "/Research/Photozpy" : "/Work/Meetings",
        title,
        url: "https://ticktick.com/task/1",
        status,
        createdAt: "2026-07-12T08:30:00.000Z",
        updatedAt,
    };
}

const ITEMS = [
    item("in-progress", "DS9 Adaptor", "2026-07-13T06:30:00.000Z", "20260713120000-abcdefg"),
    item("waiting", "Await reply", "2026-07-13T07:30:00.000Z", "20260713120001-hijklmn"),
    item("completed", "Published", "2026-07-13T08:30:00.000Z", "20260713120002-opqrstu"),
    item("failed", "Failed run", "2026-07-13T05:30:00.000Z", "20260713120003-vwxyz12"),
];

describe("task center filtering", () => {
    it("defaults to active tasks and classifies using terminal configuration", () => {
        expect(DEFAULT_TASK_CENTER_FILTER).toBe("active");
        expect(filterTaskCenterItems(ITEMS, "active", "", translate).map((entry) => entry.status))
            .toEqual(["waiting", "in-progress"]);
        expect(filterTaskCenterItems(ITEMS, "closed", "", translate).map((entry) => entry.status))
            .toEqual(["completed", "failed"]);
        expect(filterTaskCenterItems(ITEMS, "all", "", translate)).toHaveLength(4);
    });

    it("sorts by updated time descending, then title and block ID", () => {
        const timestamp = "2026-07-13T08:30:00.000Z";
        const sorted = sortTaskCenterItems([
            item("todo", "Bravo", timestamp, "20260713120004-abcdefg"),
            item("todo", "Alpha", timestamp, "20260713120006-abcdefg"),
            item("todo", "Alpha", timestamp, "20260713120005-abcdefg"),
            ITEMS[0],
        ]);
        expect(sorted.map((entry) => entry.blockId)).toEqual([
            "20260713120005-abcdefg",
            "20260713120006-abcdefg",
            "20260713120004-abcdefg",
            ITEMS[0].blockId,
        ]);
    });

    it("sorts today's pending work by nearest deadline and puts undated tasks last", () => {
        const undated = ITEMS[0];
        const later = { ...ITEMS[1], deadline: "2026-08-20" };
        const overdue = { ...ITEMS[2], deadline: "2026-08-10" };
        const today = { ...ITEMS[3], deadline: "2026-08-12" };

        expect(sortTaskCenterItemsByDeadline([undated, later, today, overdue]))
            .toEqual([overdue, today, later, undated]);
    });

    it("sorts focus work by its persistent arrangement order", () => {
        const withFocus = (
            source: TaskCenterItem,
            date: string,
            plannedAt: string,
            deadline?: string,
        ): TaskCenterItem => ({
            ...source,
            ...(deadline ? { deadline } : {}),
            focusPlan: { version: 1, entries: [{ date, plannedAt }] },
        });
        const overdue = withFocus(ITEMS[0], "2026-08-10", "2026-08-09T20:00:00.000Z", "2026-08-11");
        const carried = withFocus(ITEMS[1], "2026-08-11", "2026-08-10T20:00:00.000Z");
        const todayFirst = withFocus(ITEMS[2], "2026-08-12", "2026-08-11T19:00:00.000Z");
        const todaySecond = withFocus(ITEMS[3], "2026-08-12", "2026-08-11T20:00:00.000Z");

        expect(sortTaskCenterFocusItems(
            [todaySecond, carried, todayFirst, overdue],
            "2026-08-12",
        )).toEqual([overdue, carried, todayFirst, todaySecond]);

        const manuallyMoved = {
            ...todaySecond,
            focusPlan: {
                version: 1 as const,
                entries: [{
                    date: "2026-08-12",
                    plannedAt: "2026-08-11T20:00:00.000Z",
                    order: Date.parse("2026-08-09T19:00:00.000Z"),
                }],
            },
        };
        expect(sortTaskCenterFocusItems([overdue, manuallyMoved], "2026-08-12"))
            .toEqual([manuallyMoved, overdue]);
    });

    it.each([
        ["ds9", "DS9 Adaptor"],
        ["photozpy", "DS9 Adaptor"],
        ["research", "DS9 Adaptor"],
        ["WAITING FOR RESPONSE", "Await reply"],
    ])("searches validated in-memory data for %s", (query, expectedTitle) => {
        expect(filterTaskCenterItems(ITEMS, "all", `  ${query}  `, translate).map((entry) => entry.title))
            .toEqual([expectedTitle]);
    });

    it("does not filter for an empty search and does not change global statistics", () => {
        expect(filterTaskCenterItems(ITEMS, "all", "   ", translate)).toHaveLength(4);
        expect(countTaskCenterItems(ITEMS)).toEqual({ all: 4, active: 2, closed: 2 });
        expect(countTaskCenterItems(ITEMS)).toEqual(countTaskCenterItems(ITEMS));
    });
});
