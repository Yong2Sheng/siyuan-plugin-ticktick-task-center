import { describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES, TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
import { FocusPlanError, setTaskFocusOrder, toggleTaskFocusDate } from "./focus-plan";

const BLOCK_ID = "20260713120000-abcdefg";
const TODAY = "2026-09-08";
const TOMORROW = "2026-09-09";
const CURRENT = {
    [TASK_BLOCK_ATTRIBUTES.card]: "true",
    [TASK_BLOCK_ATTRIBUTES.version]: "1",
    [TASK_BLOCK_ATTRIBUTES.title]: "Task",
    [TASK_BLOCK_ATTRIBUTES.url]: "https://ticktick.com/task/1",
    [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
    [TASK_BLOCK_ATTRIBUTES.createdAt]: "2026-09-01T12:00:00.000Z",
    [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-09-07T12:00:00.000Z",
    [TASK_BLOCK_OPTIONAL_ATTRIBUTES.deadline]: TOMORROW,
};

function createApi(initial: Record<string, unknown> = CURRENT) {
    let attributes = { ...initial };
    return {
        loadAttributes: vi.fn().mockImplementation(async () => ({ ...attributes })),
        setBlockAttributes: vi.fn().mockImplementation(async (_blockId, next) => {
            attributes = { ...attributes, ...next };
        }),
    };
}

describe("task focus plan persistence", () => {
    it("toggles a date on the source block and verifies the stored plan", async () => {
        const api = createApi();
        const result = await toggleTaskFocusDate(
            api,
            BLOCK_ID,
            TOMORROW,
            TODAY,
            "quick",
            () => new Date("2026-09-08T20:00:00.000Z"),
        );

        expect(result.entries).toEqual([{
            date: TOMORROW,
            plannedAt: "2026-09-08T20:00:00.000Z",
        }]);
        expect(api.loadAttributes).toHaveBeenCalledTimes(2);
        expect(api.setBlockAttributes).toHaveBeenCalledOnce();

        const cleared = await toggleTaskFocusDate(api, BLOCK_ID, TOMORROW, TODAY);
        expect(cleared.entries).toEqual([]);
    });

    it("rejects a focus date after the deadline without writing", async () => {
        const api = createApi();
        await expect(toggleTaskFocusDate(api, BLOCK_ID, "2026-09-10", TODAY))
            .rejects.toMatchObject({ code: "after-deadline" });
        expect(api.setBlockAttributes).not.toHaveBeenCalled();
    });

    it("reports a write that cannot be verified", async () => {
        const api = createApi();
        api.setBlockAttributes.mockImplementationOnce(async () => undefined);
        const error = await toggleTaskFocusDate(api, BLOCK_ID, TOMORROW, TODAY)
            .catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(FocusPlanError);
        expect(error).toMatchObject({ code: "verification-failed", blockId: BLOCK_ID });
    });

    it("distinguishes loading and writing failures without applying a local result", async () => {
        const unavailable = createApi();
        unavailable.loadAttributes.mockRejectedValueOnce(new Error("load failed"));
        await expect(toggleTaskFocusDate(unavailable, BLOCK_ID, TOMORROW, TODAY))
            .rejects.toMatchObject({ code: "task-unavailable" });

        const writeFailure = createApi();
        writeFailure.setBlockAttributes.mockRejectedValueOnce(new Error("write failed"));
        await expect(toggleTaskFocusDate(writeFailure, BLOCK_ID, TOMORROW, TODAY))
            .rejects.toMatchObject({ code: "write-failed" });
    });

    it("persists exact calendar dates and a one-block manual order update", async () => {
        const api = createApi();
        const plan = await toggleTaskFocusDate(
            api,
            BLOCK_ID,
            TOMORROW,
            TODAY,
            "exact",
            () => new Date("2026-09-08T20:00:00.000Z"),
        );
        expect(plan.entries).toHaveLength(1);

        const reordered = await setTaskFocusOrder(api, BLOCK_ID, TOMORROW, 10);
        expect(reordered.entries[0]).toMatchObject({ date: TOMORROW, order: 10 });
        expect(api.setBlockAttributes).toHaveBeenCalledTimes(2);
    });
});
