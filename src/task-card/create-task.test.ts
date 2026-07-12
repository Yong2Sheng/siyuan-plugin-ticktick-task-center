import { describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { createTaskBlock, TaskCreationError, type TaskCreationApi } from "./create-task";

const REQUEST = {
    rootDocumentId: "20260712120000-abcdefg",
    taskLabel: "TickTick task",
    task: {
        title: "Task",
        url: "https://ticktick.com/t/1",
        status: "in-progress" as const,
    },
};

function createApi(): TaskCreationApi {
    return {
        prependMarkdownBlock: vi.fn().mockResolvedValue("20260712120100-hijklmn"),
        setBlockAttributes: vi.fn().mockResolvedValue(undefined),
        deleteBlock: vi.fn().mockResolvedValue(undefined),
    };
}

describe("createTaskBlock", () => {
    it("reports insertion failure without writing attributes or rolling back", async () => {
        const api = createApi();
        vi.mocked(api.prependMarkdownBlock).mockRejectedValue(new Error("insert failure"));

        await expect(createTaskBlock(api, REQUEST)).rejects.toMatchObject({
            code: "insert-failed",
        });
        expect(api.setBlockAttributes).not.toHaveBeenCalled();
        expect(api.deleteBlock).not.toHaveBeenCalled();
    });

    it("writes attributes after inserting and does not roll back on success", async () => {
        const api = createApi();
        const blockId = await createTaskBlock(api, REQUEST, () => new Date("2026-07-12T08:30:00.000Z"));

        expect(blockId).toBe("20260712120100-hijklmn");
        expect(api.prependMarkdownBlock).toHaveBeenCalledWith(
            REQUEST.rootDocumentId,
            "TickTick task：[Task](https://ticktick.com/t/1)",
        );
        expect(api.setBlockAttributes).toHaveBeenCalledOnce();
        expect(api.deleteBlock).not.toHaveBeenCalled();

        const attributes = vi.mocked(api.setBlockAttributes).mock.calls[0][1];
        expect(attributes[TASK_BLOCK_ATTRIBUTES.createdAt]).toBe("2026-07-12T08:30:00.000Z");
        expect(attributes[TASK_BLOCK_ATTRIBUTES.updatedAt])
            .toBe(attributes[TASK_BLOCK_ATTRIBUTES.createdAt]);
    });

    it("rolls back the inserted block when attribute writing fails", async () => {
        const api = createApi();
        vi.mocked(api.setBlockAttributes).mockRejectedValue(new Error("attribute failure"));

        await expect(createTaskBlock(api, REQUEST)).rejects.toMatchObject({
            code: "attribute-write-failed",
            blockId: "20260712120100-hijklmn",
        });
        expect(api.deleteBlock).toHaveBeenCalledWith("20260712120100-hijklmn");
    });

    it("rolls back the inserted block when timestamp generation fails", async () => {
        const api = createApi();

        await expect(createTaskBlock(api, REQUEST, () => new Date(Number.NaN))).rejects.toMatchObject({
            code: "attribute-write-failed",
            blockId: "20260712120100-hijklmn",
        });
        expect(api.setBlockAttributes).not.toHaveBeenCalled();
        expect(api.deleteBlock).toHaveBeenCalledWith("20260712120100-hijklmn");
    });

    it("includes the block ID when attribute writing and rollback both fail", async () => {
        const api = createApi();
        vi.mocked(api.setBlockAttributes).mockRejectedValue(new Error("attribute failure"));
        vi.mocked(api.deleteBlock).mockRejectedValue(new Error("rollback failure"));

        const error = await createTaskBlock(api, REQUEST).catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(TaskCreationError);
        expect(error).toMatchObject({
            code: "rollback-failed",
            blockId: "20260712120100-hijklmn",
        });
    });
});
