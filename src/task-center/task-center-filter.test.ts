import { describe, expect, it } from "vitest";

import type { TickTickTaskStatus } from "../domain/status";
import type { Translate } from "../i18n";
import type { TaskCenterItem } from "./task-center-data";
import {
    countTaskCenterItems,
    DEFAULT_TASK_CENTER_FILTER,
    filterTaskCenterItems,
    sortTaskCenterItems,
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
