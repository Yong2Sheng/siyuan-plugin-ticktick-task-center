import { describe, expect, it, vi } from "vitest";

import {
    defaultTaskCenterViewState,
    parseTaskCenterViewState,
    TASK_CENTER_VIEW_STATE_FILE,
    TASK_CENTER_VIEW_STATE_VERSION,
    TaskCenterViewStateStore,
    type TaskCenterViewState,
} from "./task-center-view-state";

const PARENT_ID = "20260713120000-abcdefg";
const CHILD_ID = "20260713120001-bcdefgh";

describe("parseTaskCenterViewState", () => {
    it("returns defaults for missing or non-object data", () => {
        for (const raw of [undefined, null, "text", 42, []]) {
            const parsed = parseTaskCenterViewState(raw);
            expect(parsed.unsupportedVersion).toBe(false);
            expect(parsed.state).toEqual(defaultTaskCenterViewState());
        }
    });

    it("reads a valid state and drops invalid ids, duplicates and coordinates", () => {
        const parsed = parseTaskCenterViewState({
            version: TASK_CENTER_VIEW_STATE_VERSION,
            listMode: "project",
            collapsed: [PARENT_ID, PARENT_ID, "not-an-id", CHILD_ID],
            positions: {
                [PARENT_ID]: { x: 120, y: -40 },
                [CHILD_ID]: { x: "10", y: 20 },
                "not-an-id": { x: 1, y: 2 },
            },
        });

        expect(parsed.unsupportedVersion).toBe(false);
        expect(parsed.state.listMode).toBe("project");
        expect(parsed.state.collapsed).toEqual([PARENT_ID, CHILD_ID]);
        expect(parsed.state.positions).toEqual({ [PARENT_ID]: { x: 120, y: -40 } });
    });

    it("marks an unknown version as read-only instead of overwriting it", () => {
        const parsed = parseTaskCenterViewState({
            version: 99,
            listMode: "project",
            positions: { [PARENT_ID]: { x: 1, y: 2 } },
        });

        expect(parsed.unsupportedVersion).toBe(true);
        expect(parsed.state).toEqual(defaultTaskCenterViewState());
    });

    it("falls back to today for an unknown list mode", () => {
        const parsed = parseTaskCenterViewState({
            version: TASK_CENTER_VIEW_STATE_VERSION,
            listMode: "something-else",
        });

        expect(parsed.state.listMode).toBe("today");
    });
});

describe("TaskCenterViewStateStore", () => {
    function createApi(loaded: unknown = undefined) {
        return {
            loadData: vi.fn().mockResolvedValue(loaded),
            saveData: vi.fn().mockResolvedValue(undefined),
        };
    }

    const state: TaskCenterViewState = {
        version: TASK_CENTER_VIEW_STATE_VERSION,
        listMode: "project",
        collapsed: [PARENT_ID],
        positions: { [PARENT_ID]: { x: 10, y: 20 } },
    };

    it("loads the state from the plugin data file", async () => {
        const api = createApi(state);
        const store = new TaskCenterViewStateStore(api);

        await expect(store.load()).resolves.toEqual(state);
        expect(api.loadData).toHaveBeenCalledWith(TASK_CENTER_VIEW_STATE_FILE);
    });

    it("falls back to defaults and reports a read failure", async () => {
        const onError = vi.fn();
        const api = {
            loadData: vi.fn().mockRejectedValue(new Error("disk")),
            saveData: vi.fn(),
        };
        const store = new TaskCenterViewStateStore(api, { onError });

        await expect(store.load()).resolves.toEqual(defaultTaskCenterViewState());
        expect(onError).toHaveBeenCalledOnce();
    });

    it("writes the state to the plugin data file", async () => {
        const api = createApi();
        const store = new TaskCenterViewStateStore(api);

        await store.save(state);

        expect(api.saveData).toHaveBeenCalledWith(TASK_CENTER_VIEW_STATE_FILE, state);
    });

    it("keeps reported write failures from breaking later writes", async () => {
        const onError = vi.fn();
        const api = {
            loadData: vi.fn(),
            saveData: vi.fn()
                .mockRejectedValueOnce(new Error("first"))
                .mockResolvedValueOnce(undefined),
        };
        const store = new TaskCenterViewStateStore(api, { onError });

        await store.save(state);
        await store.save({ ...state, listMode: "today" });

        expect(onError).toHaveBeenCalledOnce();
        expect(api.saveData).toHaveBeenCalledTimes(2);
    });

    it("does not overwrite an unsupported version", async () => {
        const api = createApi({ version: 99 });
        const store = new TaskCenterViewStateStore(api);

        await store.load();
        await store.save(state);

        expect(api.saveData).not.toHaveBeenCalled();
    });
});
