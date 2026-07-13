import { describe, expect, it, vi } from "vitest";

import type { PersistedTickTickTaskData } from "../domain/task";
import type { TickTickTaskStatus } from "../domain/status";
import type { TaskCenterAggregationResult, TaskCenterItem } from "./task-center-data";
import {
    createTaskCenterEditSession,
    TaskCenterController,
} from "./task-center-controller";

const FIRST_ID = "20260713120000-abcdefg";
const SECOND_ID = "20260713120001-hijklmn";
const OLD_TIME = "2026-07-13T06:30:00.000Z";
const NEW_TIME = "2026-07-13T07:30:00.000Z";
const LATEST_TIME = "2026-07-13T08:30:00.000Z";

function item(
    title: string,
    updatedAt = OLD_TIME,
    blockId = FIRST_ID,
    status: TickTickTaskStatus = "in-progress",
): TaskCenterItem {
    return {
        blockId,
        rootId: "20260713110000-opqrstu",
        notebookId: "20260713100000-vwxyz12",
        documentTitle: "Document",
        documentPath: "/Projects/Document",
        title,
        url: `https://ticktick.com/task/${blockId}`,
        status,
        createdAt: "2026-07-12T08:30:00.000Z",
        updatedAt,
    };
}

function edited(
    title: string,
    updatedAt = NEW_TIME,
    status: TickTickTaskStatus = "completed",
    url = "https://ticktick.com/task/edited",
): PersistedTickTickTaskData {
    return {
        version: 1,
        title,
        url,
        status,
        createdAt: "2026-07-12T08:30:00.000Z",
        updatedAt,
    };
}

function result(...items: TaskCenterItem[]): TaskCenterAggregationResult {
    return { items, invalidBlocks: [], incompleteBlocks: [] };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

describe("TaskCenterController", () => {
    it("loads once on start, refreshes only when requested, and rejects an older generation", async () => {
        const first = deferred<TaskCenterAggregationResult>();
        const second = deferred<TaskCenterAggregationResult>();
        const load = vi.fn()
            .mockResolvedValueOnce(result(item("Initial")))
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const controller = new TaskCenterController({ load });
        await controller.start();
        await controller.start();

        const older = controller.refresh();
        const newer = controller.refresh();
        second.resolve(result(item("New result", LATEST_TIME)));
        await newer;
        first.resolve(result(item("Old result", OLD_TIME)));
        await older;

        expect(load).toHaveBeenCalledTimes(3);
        expect(controller.getState().items[0]?.title).toBe("New result");
    });

    it("retains the last successful result when a manual refresh fails", async () => {
        const onError = vi.fn();
        const load = vi.fn()
            .mockResolvedValueOnce(result(item("Saved result")))
            .mockRejectedValueOnce(new Error("query failed"));
        const controller = new TaskCenterController({ load, onError });
        await controller.start();
        await controller.refresh();

        expect(controller.getState().error).toBe(true);
        expect(controller.getState().items[0]?.title).toBe("Saved result");
        expect(onError).toHaveBeenCalledOnce();
    });

    it("applies a task-center edit locally without SQL and preserves source metadata", async () => {
        const original = item("Original");
        const load = vi.fn().mockResolvedValue(result(original));
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.setFilter("active");
        controller.setSearch("updated");

        expect(controller.applyEditedTask(FIRST_ID, edited("Updated"))).toBe(true);

        expect(load).toHaveBeenCalledOnce();
        expect(controller.getState()).toMatchObject({ filter: "active", search: "updated" });
        expect(controller.getState().items[0]).toEqual({
            ...original,
            title: "Updated",
            url: "https://ticktick.com/task/edited",
            status: "completed",
            updatedAt: NEW_TIME,
        });
        expect(controller.getState().items[0]?.createdAt).toBe(original.createdAt);
        expect(controller.getState().items[0]?.documentPath).toBe(original.documentPath);
    });

    it("resorts local items after editing", async () => {
        const first = item("First", OLD_TIME, FIRST_ID);
        const second = item("Second", NEW_TIME, SECOND_ID);
        const controller = new TaskCenterController({ load: vi.fn().mockResolvedValue(result(first, second)) });
        await controller.start();

        controller.applyEditedTask(FIRST_ID, edited("First latest", LATEST_TIME, "in-progress"));

        expect(controller.getState().items.map(({ blockId }) => blockId)).toEqual([FIRST_ID, SECOND_ID]);
    });

    it("warns and does not invent an item when the edited block is absent", async () => {
        const onWarning = vi.fn();
        const controller = new TaskCenterController({ load: vi.fn().mockResolvedValue(result()), onWarning });
        await controller.start();

        expect(controller.applyEditedTask(FIRST_ID, edited("Missing"))).toBe(false);
        expect(controller.getState().items).toEqual([]);
        expect(onWarning).toHaveBeenCalledOnce();
    });

    it("keeps a recent local edit when manual SQL is older", async () => {
        const old = item("Old", OLD_TIME);
        const load = vi.fn()
            .mockResolvedValueOnce(result(old))
            .mockResolvedValueOnce(result(item("Stale SQL", OLD_TIME)));
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.applyEditedTask(FIRST_ID, edited("Local edit"));

        await controller.refresh();

        expect(controller.getState().items[0]).toMatchObject({
            title: "Local edit",
            status: "completed",
            updatedAt: NEW_TIME,
        });
    });

    it("clears the overlay when SQL reaches the same updatedAt", async () => {
        const old = item("Old", OLD_TIME);
        const caughtUp = { ...old, ...edited("SQL caught up") };
        const externalLater = item("External later", LATEST_TIME, FIRST_ID, "failed");
        const load = vi.fn()
            .mockResolvedValueOnce(result(old))
            .mockResolvedValueOnce(result(caughtUp))
            .mockResolvedValueOnce(result(externalLater));
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.applyEditedTask(FIRST_ID, edited("Local edit"));

        await controller.refresh();
        await controller.refresh();

        expect(controller.getState().items[0]).toMatchObject({
            title: "External later",
            status: "failed",
            updatedAt: LATEST_TIME,
        });
    });

    it("accepts a newer SQL item and clears the older overlay", async () => {
        const old = item("Old", OLD_TIME);
        const newer = item("Newer external", LATEST_TIME, FIRST_ID, "waiting");
        const load = vi.fn()
            .mockResolvedValueOnce(result(old))
            .mockResolvedValueOnce(result(newer));
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.applyEditedTask(FIRST_ID, edited("Local edit"));

        await controller.refresh();

        expect(controller.getState().items[0]).toMatchObject({
            title: "Newer external",
            status: "waiting",
            updatedAt: LATEST_TIME,
        });
    });

    it("removes an edited task and clears its overlay when SQL no longer returns it", async () => {
        const load = vi.fn()
            .mockResolvedValueOnce(result(item("Old")))
            .mockResolvedValueOnce(result())
            .mockResolvedValueOnce(result(item("Returned from SQL", OLD_TIME)));
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.applyEditedTask(FIRST_ID, edited("Local edit"));

        await controller.refresh();
        expect(controller.getState().items).toEqual([]);

        await controller.refresh();
        expect(controller.getState().items).toHaveLength(1);
        expect(controller.getState().items[0]?.title).toBe("Returned from SQL");
    });

    it("does not retain an overlay when the edited task becomes invalid", async () => {
        const load = vi.fn()
            .mockResolvedValueOnce(result(item("Old")))
            .mockResolvedValueOnce({
                items: [],
                invalidBlocks: [{ blockId: FIRST_ID, reason: "invalid-status" }],
                incompleteBlocks: [],
            });
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.applyEditedTask(FIRST_ID, edited("Local edit"));

        await controller.refresh();

        expect(controller.getState().items).toEqual([]);
        expect(controller.getState().invalidCount).toBe(1);
    });

    it("does not retain an overlay when the edited task becomes incomplete", async () => {
        const load = vi.fn()
            .mockResolvedValueOnce(result(item("Old")))
            .mockResolvedValueOnce({
                items: [],
                invalidBlocks: [],
                incompleteBlocks: [{ blockId: FIRST_ID, missingAttributes: ["custom-ticktick-status"] }],
            });
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.applyEditedTask(FIRST_ID, edited("Local edit"));

        await controller.refresh();

        expect(controller.getState().items).toEqual([]);
        expect(controller.getState().incompleteCount).toBe(1);
    });

    it("adds other SQL tasks while protecting an older edited task", async () => {
        const first = item("First", OLD_TIME, FIRST_ID);
        const second = item("Second", LATEST_TIME, SECOND_ID);
        const load = vi.fn()
            .mockResolvedValueOnce(result(first))
            .mockResolvedValueOnce(result(first, second));
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.applyEditedTask(FIRST_ID, edited("First local"));

        await controller.refresh();

        expect(controller.getState().items.map(({ title }) => title)).toEqual(["Second", "First local"]);
    });

    it("merges overlays for multiple edited blocks independently", async () => {
        const first = item("First", OLD_TIME, FIRST_ID);
        const second = item("Second", OLD_TIME, SECOND_ID);
        const load = vi.fn()
            .mockResolvedValueOnce(result(first, second))
            .mockResolvedValueOnce(result(first, second));
        const controller = new TaskCenterController({ load });
        await controller.start();
        controller.applyEditedTask(FIRST_ID, edited("First local", NEW_TIME));
        controller.applyEditedTask(SECOND_ID, edited("Second local", LATEST_TIME, "waiting"));

        await controller.refresh();

        expect(controller.getState().items.map(({ title }) => title)).toEqual(["Second local", "First local"]);
    });

    it("ignores in-flight results and local edits after destruction", async () => {
        const pending = deferred<TaskCenterAggregationResult>();
        const controller = new TaskCenterController({ load: vi.fn().mockReturnValue(pending.promise) });
        const loading = controller.start();
        controller.destroy();
        pending.resolve(result(item("Late")));
        await loading;

        expect(controller.getState().items).toEqual([]);
        expect(controller.applyEditedTask(FIRST_ID, edited("Ignored"))).toBe(false);
    });

    it("silently discards a task-center edit callback after its instance is disposed", async () => {
        const controller = new TaskCenterController({
            load: vi.fn().mockResolvedValue(result(item("Old"))),
        });
        await controller.start();
        const applyEditedTask = vi.spyOn(controller, "applyEditedTask");
        const onUnavailable = vi.fn();
        const session = createTaskCenterEditSession(controller, onUnavailable);

        session.dispose();
        controller.destroy();
        session.apply(FIRST_ID, edited("Late save"));

        expect(applyEditedTask).not.toHaveBeenCalled();
        expect(onUnavailable).not.toHaveBeenCalled();
    });
});
