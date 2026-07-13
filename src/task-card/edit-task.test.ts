import { describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import type { NormalizedTaskData } from "../domain/validation";
import { editTask, TaskEditError, type TaskEditApi } from "./edit-task";

const BLOCK_ID = "20260712120000-abcdefg";
const CURRENT = {
    [TASK_BLOCK_ATTRIBUTES.card]: "true",
    [TASK_BLOCK_ATTRIBUTES.version]: "1",
    [TASK_BLOCK_ATTRIBUTES.title]: "DS9 Adaptor",
    [TASK_BLOCK_ATTRIBUTES.url]: "https://dida365.com/task/old",
    [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
    [TASK_BLOCK_ATTRIBUTES.createdAt]: "2026-07-12T08:30:00.000Z",
    [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-07-12T09:30:00.000Z",
};
const ORIGINAL = {
    version: 1 as const,
    title: "DS9 Adaptor",
    url: "https://dida365.com/task/old",
    status: "in-progress" as const,
    createdAt: "2026-07-12T08:30:00.000Z",
    updatedAt: "2026-07-12T09:30:00.000Z",
};

function createApi(): TaskEditApi {
    return {
        loadAttributes: vi.fn().mockResolvedValue(CURRENT),
        updateMarkdownBlock: vi.fn().mockResolvedValue(undefined),
        setBlockAttributes: vi.fn().mockResolvedValue(undefined),
    };
}

function request(next: NormalizedTaskData = {
    title: ORIGINAL.title,
    url: ORIGINAL.url,
    status: ORIGINAL.status,
}) {
    return {
        blockId: BLOCK_ID,
        original: ORIGINAL,
        taskLabel: "TickTick task",
        next,
    };
}

describe("editTask", () => {
    it("does not write or generate a timestamp when normalized data is unchanged", async () => {
        const api = createApi();
        const now = vi.fn();

        await expect(editTask(api, request(), now)).resolves.toMatchObject({ changed: false });
        expect(now).not.toHaveBeenCalled();
        expect(api.updateMarkdownBlock).not.toHaveBeenCalled();
        expect(api.setBlockAttributes).not.toHaveBeenCalled();
    });

    it("updates only complete attributes for a status-only change", async () => {
        const api = createApi();
        const result = await editTask(api, request({
            title: ORIGINAL.title,
            url: ORIGINAL.url,
            status: "completed",
        }), () => new Date("2026-07-12T10:30:00.000Z"));

        expect(result).toMatchObject({ changed: true });
        expect(api.updateMarkdownBlock).not.toHaveBeenCalled();
        expect(api.setBlockAttributes).toHaveBeenCalledOnce();
        const attributes = vi.mocked(api.setBlockAttributes).mock.calls[0][1];
        expect(Object.keys(attributes)).toHaveLength(7);
        expect(attributes[TASK_BLOCK_ATTRIBUTES.card]).toBe("true");
        expect(attributes[TASK_BLOCK_ATTRIBUTES.version]).toBe("1");
        expect(attributes[TASK_BLOCK_ATTRIBUTES.title]).toBe(ORIGINAL.title);
        expect(attributes[TASK_BLOCK_ATTRIBUTES.url]).toBe(ORIGINAL.url);
        expect(attributes[TASK_BLOCK_ATTRIBUTES.createdAt]).toBe(ORIGINAL.createdAt);
        expect(attributes[TASK_BLOCK_ATTRIBUTES.updatedAt]).toBe("2026-07-12T10:30:00.000Z");
        expect(attributes[TASK_BLOCK_ATTRIBUTES.status]).toBe("completed");
    });

    it("updates Markdown before attributes when the title changes", async () => {
        const api = createApi();
        await editTask(api, request({
            title: "New [DS9]\\Name\nLine",
            url: ORIGINAL.url,
            status: ORIGINAL.status,
        }));

        expect(api.updateMarkdownBlock).toHaveBeenCalledWith(
            BLOCK_ID,
            "TickTick task：[New \\[DS9\\]\\\\Name Line](https://dida365.com/task/old)",
        );
        expect(vi.mocked(api.updateMarkdownBlock).mock.invocationCallOrder[0])
            .toBeLessThan(vi.mocked(api.setBlockAttributes).mock.invocationCallOrder[0]);
    });

    it("writes the normalized URL to Markdown and attributes", async () => {
        const api = createApi();
        await editTask(api, request({
            title: ORIGINAL.title,
            url: "https://ticktick.com/task/new",
            status: ORIGINAL.status,
        }));

        expect(api.updateMarkdownBlock).toHaveBeenCalledWith(
            BLOCK_ID,
            "TickTick task：[DS9 Adaptor](https://ticktick.com/task/new)",
        );
        const attributes = vi.mocked(api.setBlockAttributes).mock.calls[0][1];
        expect(attributes[TASK_BLOCK_ATTRIBUTES.url]).toBe("https://ticktick.com/task/new");
    });

    it("does not write attributes when Markdown update fails", async () => {
        const api = createApi();
        vi.mocked(api.updateMarkdownBlock).mockRejectedValueOnce(new Error("content failed"));

        await expect(editTask(api, request({
            title: "New title",
            url: ORIGINAL.url,
            status: ORIGINAL.status,
        }))).rejects.toMatchObject({ code: "content-update-failed", blockId: BLOCK_ID });
        expect(api.setBlockAttributes).not.toHaveBeenCalled();
    });

    it("rolls back original Markdown when attribute writing fails", async () => {
        const api = createApi();
        vi.mocked(api.setBlockAttributes).mockRejectedValue(new Error("attributes failed"));

        await expect(editTask(api, request({
            title: "New title",
            url: ORIGINAL.url,
            status: ORIGINAL.status,
        }))).rejects.toMatchObject({ code: "attribute-write-failed", blockId: BLOCK_ID });
        expect(api.updateMarkdownBlock).toHaveBeenNthCalledWith(
            2,
            BLOCK_ID,
            "TickTick task：[DS9 Adaptor](https://dida365.com/task/old)",
        );
    });

    it("reports rollback failure with block ID and both errors", async () => {
        const api = createApi();
        const attributeError = new Error("attributes failed");
        const rollbackError = new Error("rollback failed");
        vi.mocked(api.setBlockAttributes).mockRejectedValue(attributeError);
        vi.mocked(api.updateMarkdownBlock)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(rollbackError);

        const error = await editTask(api, request({
            title: "New title",
            url: ORIGINAL.url,
            status: ORIGINAL.status,
        })).catch((reason: unknown) => reason);

        expect(error).toBeInstanceOf(TaskEditError);
        expect(error).toMatchObject({
            code: "rollback-failed",
            blockId: BLOCK_ID,
            originalError: attributeError,
            rollbackError,
        });
    });

    it("rejects a stale edit snapshot without any write", async () => {
        const api = createApi();
        vi.mocked(api.loadAttributes).mockResolvedValue({
            ...CURRENT,
            [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-07-12T11:00:00.000Z",
        });

        await expect(editTask(api, request({
            title: "New title",
            url: ORIGINAL.url,
            status: ORIGINAL.status,
        }))).rejects.toMatchObject({
            code: "edit-conflict",
            blockId: BLOCK_ID,
            currentUpdatedAt: "2026-07-12T11:00:00.000Z",
            snapshotUpdatedAt: ORIGINAL.updatedAt,
        });
        expect(api.updateMarkdownBlock).not.toHaveBeenCalled();
        expect(api.setBlockAttributes).not.toHaveBeenCalled();
    });

    it("fails safely when the current block cannot be loaded", async () => {
        const api = createApi();
        vi.mocked(api.loadAttributes).mockRejectedValue(new Error("not found"));

        await expect(editTask(api, request())).rejects.toMatchObject({
            code: "block-unavailable",
            blockId: BLOCK_ID,
        });
    });

    it("fails safely when current task attributes are invalid", async () => {
        const api = createApi();
        vi.mocked(api.loadAttributes).mockResolvedValue({
            ...CURRENT,
            [TASK_BLOCK_ATTRIBUTES.status]: "unknown",
        });

        await expect(editTask(api, request())).rejects.toMatchObject({
            code: "current-data-invalid",
            blockId: BLOCK_ID,
        });
        expect(api.updateMarkdownBlock).not.toHaveBeenCalled();
        expect(api.setBlockAttributes).not.toHaveBeenCalled();
    });
});
