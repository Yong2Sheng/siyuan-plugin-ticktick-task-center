// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import type { TickTickTaskStatus } from "../domain/status";
import { getLocalDate } from "./daily-progress";
import type { TaskCenterItem } from "./task-center-data";
import { TaskCenterController } from "./task-center-controller";
import { TaskCenterView } from "./task-center-view";

const dictionary: Record<string, string> = {
    "taskCenterView.title": "Task Center",
    "taskCenterView.refresh": "Refresh",
    "taskCenterView.refreshing": "Refreshing",
    "taskCenterView.filterActive": "Active",
    "taskCenterView.filterClosed": "Closed",
    "taskCenterView.filterAll": "All tasks",
    "taskCenterView.searchPlaceholder": "Search tasks",
    "taskCenterView.summaryAll": "All",
    "taskCenterView.summaryActive": "Active",
    "taskCenterView.summaryClosed": "Closed",
    "taskCenterView.summaryToday": "✨ Today’s progress",
    "taskCenterView.dailyPending": "🌤️ To progress today",
    "taskCenterView.dailyProgressed": "✨ Today’s progress",
    "taskCenterView.dailyAdvanced": "🚀 Advanced",
    "taskCenterView.dailyCompleted": "🏆 Completed today",
    "taskCenterView.dailyCompletedBadge": "🏆 Completed today",
    "taskCenterView.dailyProgressAction": "🚀 Progress today",
    "taskCenterView.dailyProgressDone": "✨ Progressed today",
    "taskCenterView.dailyProgressTitle": "Mark progress",
    "taskCenterView.dailyProgressUndoTitle": "Undo progress",
    "taskCenterView.source": "Source",
    "taskCenterView.updated": "Updated",
    "taskCenterView.locate": "Locate",
    "taskCenterView.openTickTick": "Open TickTick",
    "taskCenterView.loading": "Loading tasks",
    "taskCenterView.loadFailed": "Load failed",
    "taskCenterView.retry": "Retry",
    "taskCenterView.emptyActive": "No active tasks",
    "taskCenterView.emptyClosed": "No closed tasks",
    "taskCenterView.emptyAll": "No tasks",
    "taskCenterView.emptySearch": "No matches",
    "taskCenterView.invalidSkipped": "Skipped ${count}",
    "taskCenterView.incompleteRead": "Incomplete ${count}",
    "taskEdit.statusButtonTitle": "Click to edit task",
    "taskEdit.statusButtonAriaLabel": "Edit task, current status: ${status}",
    "taskEdit.workModeButtonTitle": "Click to edit work category",
    "taskEdit.workModeButtonAriaLabel": "Edit task, current work category: ${workMode}",
    "workMode.review": "评审-Review",
    "workMode.unclassified": "未分类-Unclassified",
    "status.inProgress": "In progress",
    "status.blocked": "Blocked",
    "status.completed": "Completed",
    "deadline.none": "No deadline",
    "deadline.setAction": "Set deadline",
    "deadline.remainingDays": "${count} days left",
    "deadline.dueToday": "Due today",
    "deadline.overdueDays": "${count} days overdue",
    "deadline.editTitle": "Edit deadline",
    "deadline.editAriaLabel": "Edit deadline: ${summary}, ${date}",
};
const translate: Translate = (key) => dictionary[key] ?? key;

function item(status: TickTickTaskStatus, title: string, id: string): TaskCenterItem {
    return {
        blockId: id,
        rootId: "20260713110000-hijklmn",
        documentTitle: "Photozpy",
        documentPath: "/Research/Photozpy",
        title,
        url: `https://ticktick.com/task/${id}`,
        status,
        createdAt: "2026-07-12T08:30:00.000Z",
        updatedAt: status === "completed"
            ? "2026-07-13T07:30:00.000Z"
            : "2026-07-13T06:30:00.000Z",
    };
}

const ACTIVE = item("in-progress", "DS9 Adaptor", "20260713120000-abcdefg");
ACTIVE.workMode = "review";
const CLOSED = item("completed", "Published", "20260713120001-hijklmn");
const BLOCKED = item("blocked", "Waiting for access", "20260713120002-opqrstu");
const TODAY = getLocalDate();
const TODAY_UPDATED_AT = (() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date.toISOString();
})();

async function createView(load = vi.fn().mockResolvedValue({
    items: [ACTIVE, CLOSED],
    invalidBlocks: [],
    incompleteBlocks: [],
})) {
    const target = document.createElement("div");
    document.body.append(target);
    const controller = new TaskCenterController({ load });
    const onEditTask = vi.fn();
    const onLocateTask = vi.fn();
    const onSaveDailyProgress = vi.fn().mockResolvedValue(undefined);
    const onDailyProgressError = vi.fn();
    const view = new TaskCenterView(target, {
        controller,
        translate,
        locale: "en-US",
        onEditTask,
        onLocateTask,
        onSaveDailyProgress,
        onDailyProgressError,
    });
    await controller.start();
    return {
        target,
        controller,
        view,
        load,
        onEditTask,
        onLocateTask,
        onSaveDailyProgress,
        onDailyProgressError,
    };
}

describe("TaskCenterView", () => {
    beforeEach(() => document.body.replaceChildren());

    it("defaults to active tasks and switches classification", async () => {
        const { target } = await createView();
        expect(target.querySelectorAll(".ticktick-task-center__item")).toHaveLength(1);
        expect(target.querySelector(".ticktick-task-center__title")?.textContent).toBe("DS9 Adaptor");
        expect(target.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.textContent).toBe("Active");

        const closed = Array.from(target.querySelectorAll<HTMLButtonElement>(".ticktick-task-center__filter"))
            .find((button) => button.textContent === "Closed");
        closed?.click();
        expect(target.querySelector(".ticktick-task-center__title")?.textContent).toBe("Published");
    });

    it("filters locally from search input without another load", async () => {
        const { target, load } = await createView();
        const all = Array.from(target.querySelectorAll<HTMLButtonElement>(".ticktick-task-center__filter"))
            .find((button) => button.textContent === "All tasks");
        all?.click();
        const search = target.querySelector<HTMLInputElement>(".ticktick-task-center__search")!;
        search.value = "published";
        search.dispatchEvent(new Event("input", { bubbles: true }));

        expect(target.querySelectorAll(".ticktick-task-center__item")).toHaveLength(1);
        expect(target.querySelector(".ticktick-task-center__title")?.textContent).toBe("Published");
        expect(load).toHaveBeenCalledOnce();
    });

    it("stacks work category above status and reuses edit and locate actions", async () => {
        const { target, onEditTask, onLocateTask } = await createView();
        const article = target.querySelector<HTMLElement>(".ticktick-task-center__item")!;
        const status = article.querySelector<HTMLButtonElement>(".ticktick-task-center__status")!;
        const workMode = article.querySelector<HTMLButtonElement>(".ticktick-task-center__work-mode")!;
        const classification = article.querySelector<HTMLElement>(".ticktick-task-center__classification")!;
        const title = article.querySelector<HTMLButtonElement>(".ticktick-task-center__title")!;

        expect(article.dataset.statusTone).toBe("primary");
        expect(status.textContent).toBe("▶️ In progress");
        expect(workMode.textContent).toBe("🔎 评审-Review");
        expect(Array.from(classification.children)).toEqual([workMode, status]);
        workMode.click();
        status.click();
        title.click();
        expect(onEditTask).toHaveBeenCalledWith(ACTIVE.blockId, "work-mode");
        expect(onEditTask).toHaveBeenCalledWith(ACTIVE.blockId, "status");
        expect(onLocateTask).toHaveBeenCalledWith(
            ACTIVE.blockId,
            ACTIVE.rootId,
            ACTIVE.notebookId,
        );
    });

    it("renders the eight-segment deadline editor and opens the deadline field", async () => {
        const dueToday = { ...ACTIVE, deadline: TODAY };
        const { target, onEditTask } = await createView(vi.fn().mockResolvedValue({
            items: [dueToday],
            invalidBlocks: [],
            incompleteBlocks: [],
        }));
        const article = target.querySelector<HTMLElement>(".ticktick-task-center__item")!;
        const deadline = article.querySelector<HTMLButtonElement>(".ticktick-task-center__deadline")!;

        expect(article.dataset.deadlineState).toBe("today");
        expect(deadline.querySelector(".ticktick-task-center__deadline-summary")?.textContent)
            .toBe("Due today");
        expect(deadline.querySelectorAll('[data-filled="true"]')).toHaveLength(8);
        deadline.click();
        expect(onEditTask).toHaveBeenCalledWith(ACTIVE.blockId, "deadline");
    });

    it("orders today's pending tasks by deadline and leaves undated tasks last", async () => {
        const undated = { ...ACTIVE, title: "Undated" };
        const later = {
            ...ACTIVE,
            blockId: "20260713120003-vwxyz12",
            title: "Later",
            deadline: "2026-08-20",
        };
        const earlier = {
            ...ACTIVE,
            blockId: "20260713120004-abcdefg",
            title: "Earlier",
            deadline: "2026-08-14",
        };
        const { target } = await createView(vi.fn().mockResolvedValue({
            items: [undated, later, earlier],
            invalidBlocks: [],
            incompleteBlocks: [],
        }));

        expect(Array.from(
            target.querySelectorAll(
                ".ticktick-task-center__daily-group--pending .ticktick-task-center__title",
            ),
            (node) => node.textContent,
        )).toEqual(["Earlier", "Later", "Undated"]);
    });

    it("renders a safe external URL and semantic localized time", async () => {
        const { target } = await createView();
        const external = target.querySelector<HTMLAnchorElement>(".ticktick-task-center__external")!;
        const time = target.querySelector<HTMLTimeElement>("time")!;

        expect(external.href).toBe(ACTIVE.url);
        expect(external.target).toBe("_blank");
        expect(external.rel).toBe("noopener noreferrer");
        expect(time.dateTime).toBe(ACTIVE.updatedAt);
        expect(time.textContent).not.toBe(ACTIVE.updatedAt);
    });

    it("shows incomplete and invalid task notices together with empty states", async () => {
        const load = vi.fn().mockResolvedValue({
            items: [],
            invalidBlocks: [{ blockId: "bad", reason: "invalid-block-id" }],
            incompleteBlocks: [{ blockId: "partial", missingAttributes: ["custom-ticktick-url"] }],
        });
        const { target } = await createView(load);
        expect(Array.from(
            target.querySelectorAll(".ticktick-task-center__notice > div"),
            (notice) => notice.textContent,
        )).toEqual(["Incomplete 1", "Skipped 1"]);
        expect(target.querySelector(".ticktick-task-center__empty")?.textContent).toBe("No tasks");
    });

    it("shows loading, query error, and retries", async () => {
        let reject!: (error: unknown) => void;
        const first = new Promise<never>((_resolve, rejectPromise) => {
            reject = rejectPromise;
        });
        const load = vi.fn()
            .mockReturnValueOnce(first)
            .mockResolvedValueOnce({ items: [ACTIVE], invalidBlocks: [], incompleteBlocks: [] });
        const target = document.createElement("div");
        document.body.append(target);
        const controller = new TaskCenterController({ load });
        const view = new TaskCenterView(target, {
            controller,
            translate,
            onEditTask: vi.fn(),
            onLocateTask: vi.fn(),
            onSaveDailyProgress: vi.fn().mockResolvedValue(undefined),
        });

        const start = controller.start();
        expect(target.querySelector(".ticktick-task-center__loading")?.textContent).toBe("Loading tasks");
        reject(new Error("failed"));
        await start;
        expect(target.querySelector(".ticktick-task-center__error")?.textContent).toContain("Load failed");
        target.querySelector<HTMLButtonElement>(".ticktick-task-center__retry")?.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(target.querySelector(".ticktick-task-center__title")?.textContent).toBe("DS9 Adaptor");
        view.destroy();
    });

    it("manual refresh calls the controller and keeps a responsive class-only layout", async () => {
        const { target, load } = await createView();
        target.querySelector<HTMLButtonElement>(".ticktick-task-center__refresh")?.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(load).toHaveBeenCalledTimes(2);
        expect(target.querySelector("[style*='width']")).toBeNull();
    });

    it("keeps a task completed today in the active view's progress area", async () => {
        const completed = { ...ACTIVE, status: "completed" as const, updatedAt: TODAY_UPDATED_AT };
        const load = vi.fn().mockResolvedValueOnce({
            items: [ACTIVE],
            invalidBlocks: [],
            incompleteBlocks: [],
        });
        const harness = await createView(load);
        expect(harness.target.querySelectorAll(".ticktick-task-center__item")).toHaveLength(1);

        harness.controller.applyEditedTask(completed.blockId, {
            version: 1,
            title: completed.title,
            url: completed.url,
            status: completed.status,
            createdAt: completed.createdAt,
            updatedAt: completed.updatedAt,
        });

        expect(load).toHaveBeenCalledOnce();
        expect(harness.target.querySelectorAll(".ticktick-task-center__item")).toHaveLength(1);
        expect(harness.target.querySelector(".ticktick-task-center__empty")).toBeNull();
        expect(harness.target.querySelector(
            ".ticktick-task-center__daily-subgroup--completed .ticktick-task-center__title",
        )?.textContent).toBe(completed.title);
        expect(harness.target.querySelector(
            ".ticktick-task-center__daily-subgroup--completed .ticktick-task-center__status",
        )?.textContent).toBe("✅ Completed");
        expect(harness.target.querySelector(".ticktick-task-center__daily-completed")?.textContent)
            .toBe("🏆 Completed today");
        expect(Array.from(harness.target.querySelectorAll(".ticktick-task-center__summary-item"), (node) => node.textContent))
            .toEqual(["All 1", "Active 0", "Closed 1", "✨ Today’s progress 1 / 1"]);

        const closed = Array.from(harness.target.querySelectorAll<HTMLButtonElement>(".ticktick-task-center__filter"))
            .find((button) => button.textContent === "Closed");
        closed?.click();
        expect(harness.target.querySelector(".ticktick-task-center__title")?.textContent).toBe(completed.title);
    });

    it("shows completed work in today's progress but excludes failed terminal tasks", async () => {
        const completedToday = { ...CLOSED, lastProgressedDate: TODAY };
        const failedToday = {
            ...item("failed", "Failed experiment", "20260713120003-vwxyz12"),
            lastProgressedDate: TODAY,
        };
        const { target, controller } = await createView(vi.fn().mockResolvedValue({
            items: [completedToday, failedToday],
            invalidBlocks: [],
            incompleteBlocks: [],
        }));

        expect(Array.from(target.querySelectorAll(".ticktick-task-center__title"), (node) => node.textContent))
            .toEqual([CLOSED.title]);
        expect(target.querySelector(".ticktick-task-center__daily-subheading")?.textContent)
            .toBe("🏆 Completed today 1");
        expect(Array.from(target.querySelectorAll(".ticktick-task-center__summary-item"), (node) => node.textContent))
            .toEqual(["All 2", "Active 0", "Closed 2", "✨ Today’s progress 1 / 1"]);

        controller.setSearch("failed");
        expect(target.querySelectorAll(".ticktick-task-center__item")).toHaveLength(0);
        expect(target.querySelector(".ticktick-task-center__empty")?.textContent).toBe("No matches");
    });

    it("groups every non-terminal status by today's progress, including blocked tasks", async () => {
        const progressed = { ...ACTIVE, lastProgressedDate: TODAY };
        const { target } = await createView(vi.fn().mockResolvedValue({
            items: [BLOCKED, progressed],
            invalidBlocks: [],
            incompleteBlocks: [],
        }));

        const groups = target.querySelectorAll<HTMLElement>(".ticktick-task-center__daily-group");
        expect(groups).toHaveLength(2);
        expect(groups[0]?.querySelector(".ticktick-task-center__daily-heading")?.textContent)
            .toBe("🌤️ To progress today 1");
        expect(groups[0]?.querySelector(".ticktick-task-center__title")?.textContent)
            .toBe(BLOCKED.title);
        expect(groups[0]?.querySelector(".ticktick-task-center__status")?.textContent)
            .toBe("⛔ Blocked");
        expect(groups[1]?.querySelector(".ticktick-task-center__daily-heading")?.textContent)
            .toBe("✨ Today’s progress 1");
        expect(groups[1]?.querySelector(".ticktick-task-center__daily-subheading")?.textContent)
            .toBe("🚀 Advanced 1");
        expect(groups[1]?.querySelector(".ticktick-task-center__title")?.textContent)
            .toBe(ACTIVE.title);
        expect(Array.from(target.querySelectorAll(".ticktick-task-center__summary-item"), (node) => node.textContent))
            .toEqual(["All 2", "Active 2", "Closed 0", "✨ Today’s progress 1 / 2"]);
        expect(target.querySelector(".ticktick-task-center__summary-item--daily")).not.toBeNull();
        expect(groups[0]?.querySelector(".ticktick-task-center__daily-progress")?.textContent)
            .toBe("🚀 Progress today");
        expect(groups[1]?.querySelector(".ticktick-task-center__daily-progress")?.textContent)
            .toBe("✨ Progressed today");
    });

    it("persists, moves, and can undo a daily progress mark without reloading SQL", async () => {
        const harness = await createView(vi.fn().mockResolvedValue({
            items: [ACTIVE],
            invalidBlocks: [],
            incompleteBlocks: [],
        }));

        harness.target.querySelector<HTMLButtonElement>(".ticktick-task-center__daily-progress")?.click();
        await vi.waitFor(() => {
            expect(harness.onSaveDailyProgress).toHaveBeenCalledWith(ACTIVE.blockId, TODAY);
            expect(harness.controller.getState().items[0]?.lastProgressedDate).toBe(TODAY);
        });
        expect(harness.load).toHaveBeenCalledOnce();
        expect(harness.target.querySelector(".ticktick-task-center__daily-group--progressed .ticktick-task-center__title")?.textContent)
            .toBe(ACTIVE.title);

        harness.target.querySelector<HTMLButtonElement>(
            ".ticktick-task-center__daily-group--progressed .ticktick-task-center__daily-progress",
        )?.click();
        await vi.waitFor(() => {
            expect(harness.onSaveDailyProgress).toHaveBeenLastCalledWith(ACTIVE.blockId, undefined);
            expect(harness.controller.getState().items[0]?.lastProgressedDate).toBeUndefined();
        });
        expect(harness.target.querySelector(".ticktick-task-center__daily-group--pending .ticktick-task-center__title")?.textContent)
            .toBe(ACTIVE.title);
    });

    it("keeps a task pending and reports an error when daily progress cannot be saved", async () => {
        const harness = await createView();
        harness.onSaveDailyProgress.mockRejectedValueOnce(new Error("attributes failed"));

        harness.target.querySelector<HTMLButtonElement>(".ticktick-task-center__daily-progress")?.click();
        await vi.waitFor(() => expect(harness.onDailyProgressError).toHaveBeenCalledOnce());

        expect(harness.controller.getState().items[0]?.lastProgressedDate).toBeUndefined();
        expect(harness.target.querySelector(".ticktick-task-center__daily-group--pending .ticktick-task-center__title")?.textContent)
            .toBe(ACTIVE.title);
    });

    it("moves yesterday's progress back to pending after local midnight without rewriting data", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 7, 11, 23, 59, 59, 900));
        try {
            const progressed = { ...ACTIVE, lastProgressedDate: "2026-08-11" };
            const harness = await createView(vi.fn().mockResolvedValue({
                items: [progressed],
                invalidBlocks: [],
                incompleteBlocks: [],
            }));
            expect(harness.target.querySelector(
                ".ticktick-task-center__daily-group--progressed .ticktick-task-center__title",
            )?.textContent).toBe(ACTIVE.title);

            await vi.advanceTimersByTimeAsync(150);

            expect(harness.target.querySelector(
                ".ticktick-task-center__daily-group--pending .ticktick-task-center__title",
            )?.textContent).toBe(ACTIVE.title);
            expect(harness.onSaveDailyProgress).not.toHaveBeenCalled();
            harness.view.destroy();
        } finally {
            vi.useRealTimers();
        }
    });

    it("updates the rendered title and external URL locally without another query", async () => {
        const harness = await createView(vi.fn().mockResolvedValue({
            items: [ACTIVE],
            invalidBlocks: [],
            incompleteBlocks: [],
        }));

        harness.controller.applyEditedTask(ACTIVE.blockId, {
            version: 1,
            title: "Updated title",
            url: "https://ticktick.com/task/updated",
            status: ACTIVE.status,
            createdAt: ACTIVE.createdAt,
            updatedAt: "2026-07-13T10:30:00.000Z",
        });

        expect(harness.load).toHaveBeenCalledOnce();
        expect(harness.target.querySelector(".ticktick-task-center__title")?.textContent)
            .toBe("Updated title");
        expect(harness.target.querySelector<HTMLAnchorElement>(".ticktick-task-center__external")?.href)
            .toBe("https://ticktick.com/task/updated");
    });

    it("preserves search and classification while replacing and resorting refreshed data", async () => {
        const older = { ...ACTIVE, title: "DS9 Older", updatedAt: "2026-07-13T05:30:00.000Z" };
        const newer = {
            ...ACTIVE,
            blockId: "20260713120002-opqrstu",
            title: "DS9 Newer",
            updatedAt: "2026-07-13T10:30:00.000Z",
        };
        const load = vi.fn()
            .mockResolvedValueOnce({ items: [older, newer], invalidBlocks: [], incompleteBlocks: [] });
        const { target, controller } = await createView(load);
        controller.setSearch("ds9");

        controller.applyEditedTask(older.blockId, {
            version: 1,
            title: "DS9 Older edited",
            url: older.url,
            status: older.status,
            createdAt: older.createdAt,
            updatedAt: "2026-07-13T11:30:00.000Z",
        });

        expect(target.querySelector<HTMLInputElement>(".ticktick-task-center__search")?.value).toBe("ds9");
        expect(target.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.textContent).toBe("Active");
        expect(Array.from(target.querySelectorAll(".ticktick-task-center__title"), (node) => node.textContent))
            .toEqual(["DS9 Older edited", "DS9 Newer"]);
        expect(load).toHaveBeenCalledOnce();
    });
});
