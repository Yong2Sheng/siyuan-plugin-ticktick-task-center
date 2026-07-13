// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
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
    "status.inProgress": "In progress",
    "status.completed": "Completed",
};
const translate: Translate = (key) => dictionary[key] ?? key;

function item(status: "in-progress" | "completed", title: string, id: string): TaskCenterItem {
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
const CLOSED = item("completed", "Published", "20260713120001-hijklmn");

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
    const view = new TaskCenterView(target, {
        controller,
        translate,
        locale: "en-US",
        onEditTask,
        onLocateTask,
    });
    await controller.start();
    return { target, controller, view, load, onEditTask, onLocateTask };
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

    it("renders shared status tone and reuses edit and locate actions", async () => {
        const { target, onEditTask, onLocateTask } = await createView();
        const article = target.querySelector<HTMLElement>(".ticktick-task-center__item")!;
        const status = article.querySelector<HTMLButtonElement>(".ticktick-task-center__status")!;
        const title = article.querySelector<HTMLButtonElement>(".ticktick-task-center__title")!;

        expect(article.dataset.statusTone).toBe("primary");
        expect(status.textContent).toBe("▶️ In progress");
        status.click();
        title.click();
        expect(onEditTask).toHaveBeenCalledWith(ACTIVE.blockId);
        expect(onLocateTask).toHaveBeenCalledWith(ACTIVE.blockId);
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

    it("rerenders classification and statistics immediately after a local edit", async () => {
        const completed = { ...ACTIVE, status: "completed" as const, updatedAt: "2026-07-13T09:30:00.000Z" };
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
        expect(harness.target.querySelectorAll(".ticktick-task-center__item")).toHaveLength(0);
        expect(harness.target.querySelector(".ticktick-task-center__empty")?.textContent).toBe("No active tasks");
        expect(Array.from(harness.target.querySelectorAll(".ticktick-task-center__summary-item"), (node) => node.textContent))
            .toEqual(["All 1", "Active 0", "Closed 1"]);

        const closed = Array.from(harness.target.querySelectorAll<HTMLButtonElement>(".ticktick-task-center__filter"))
            .find((button) => button.textContent === "Closed");
        closed?.click();
        expect(harness.target.querySelector(".ticktick-task-center__title")?.textContent).toBe(completed.title);
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
