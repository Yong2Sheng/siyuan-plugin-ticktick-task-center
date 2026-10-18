import { describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
import { saveTaskPriority, type TaskPriorityApi } from "./task-priority";

const BLOCK_ID = "20260713120000-abcdefg";

function createApi(initial: Record<string, unknown> = {}): TaskPriorityApi & {
    setBlockAttributes: ReturnType<typeof vi.fn>;
} {
    let attributes = { ...initial };
    return {
        loadAttributes: vi.fn().mockImplementation(async () => ({ ...attributes })),
        setBlockAttributes: vi.fn().mockImplementation(async (_blockId, next) => {
            attributes = { ...attributes, ...next };
        }),
    };
}

describe("task priority persistence", () => {
    it("writes the chosen level and verifies it by re-reading", async () => {
        const api = createApi();
        await saveTaskPriority(api, BLOCK_ID, "high");

        expect(api.setBlockAttributes).toHaveBeenCalledWith(BLOCK_ID, {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: "high",
        });
        // 只读取一次，用来复核写入结果；写入前不需要预读（只改一个属性，不做冲突检测）。
        expect(api.loadAttributes).toHaveBeenCalledTimes(1);
    });

    it("clears the attribute when the normal level is chosen", async () => {
        const api = createApi({ [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: "high" });
        await saveTaskPriority(api, BLOCK_ID, "normal");

        // 「正常推进」与「未设置」语义等同，因此这一档写空字符串。
        expect(api.setBlockAttributes).toHaveBeenCalledWith(BLOCK_ID, {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: "",
        });
    });

    it("reports a write that cannot be verified", async () => {
        const api = createApi();
        api.setBlockAttributes.mockImplementationOnce(async () => undefined);

        await expect(saveTaskPriority(api, BLOCK_ID, "low")).rejects.toThrow(
            `Task priority verification failed for ${BLOCK_ID}`,
        );
    });

    it("does not swallow a write failure", async () => {
        const api = createApi();
        api.setBlockAttributes.mockRejectedValueOnce(new Error("write failed"));

        await expect(saveTaskPriority(api, BLOCK_ID, "high")).rejects.toThrow("write failed");
    });

    it("accepts a task that had no priority before the field existed", async () => {
        const api = createApi();
        await expect(saveTaskPriority(api, BLOCK_ID, "low")).resolves.toBeUndefined();
    });
});
