import { describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import { TaskDeleteController } from "./delete-controller";

const BLOCK_ID = "20260713120000-abcdefg";
const translate: Translate = (key) => ({
    "taskActions.deleteConfirmTitle": "Delete task card?",
    "taskActions.deleteConfirmMessage": "Delete “${title}”?<br>TickTick is unchanged.",
})[key] ?? key;

function createController(confirmResult = true) {
    const deleteBlock = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.fn().mockResolvedValue(confirmResult);
    const onDeleted = vi.fn();
    const onError = vi.fn();
    const controller = new TaskDeleteController({
        translate,
        deleteBlock,
        confirm,
        onDeleted,
        onError,
    });
    return { controller, deleteBlock, confirm, onDeleted, onError };
}

describe("TaskDeleteController", () => {
    it("confirms the exact task and deletes its source block", async () => {
        const harness = createController();

        await expect(harness.controller.request(BLOCK_ID, "DS9 <Adaptor>"))
            .resolves.toBe(true);

        expect(harness.confirm).toHaveBeenCalledWith(
            "Delete task card?",
            "Delete “DS9 &lt;Adaptor&gt;”?<br>TickTick is unchanged.",
        );
        expect(harness.deleteBlock).toHaveBeenCalledWith(BLOCK_ID);
        expect(harness.onDeleted).toHaveBeenCalledOnce();
        expect(harness.onError).not.toHaveBeenCalled();
    });

    it("leaves the source block untouched after cancellation", async () => {
        const harness = createController(false);

        await expect(harness.controller.request(BLOCK_ID, "DS9 Adaptor"))
            .resolves.toBe(false);

        expect(harness.deleteBlock).not.toHaveBeenCalled();
        expect(harness.onDeleted).not.toHaveBeenCalled();
    });

    it("reports a failed deletion without claiming success", async () => {
        const harness = createController();
        const error = new Error("delete failed");
        harness.deleteBlock.mockRejectedValue(error);

        await expect(harness.controller.request(BLOCK_ID, "DS9 Adaptor"))
            .resolves.toBe(false);

        expect(harness.onError).toHaveBeenCalledWith(error, BLOCK_ID);
        expect(harness.onDeleted).not.toHaveBeenCalled();
    });

    it("deduplicates simultaneous deletion requests for one block", async () => {
        let resolveConfirmation!: (confirmed: boolean) => void;
        const confirmation = new Promise<boolean>((resolve) => {
            resolveConfirmation = resolve;
        });
        const harness = createController();
        harness.confirm.mockReturnValue(confirmation);

        const first = harness.controller.request(BLOCK_ID, "DS9 Adaptor");
        const second = harness.controller.request(BLOCK_ID, "DS9 Adaptor");
        resolveConfirmation(true);

        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        expect(harness.confirm).toHaveBeenCalledOnce();
        expect(harness.deleteBlock).toHaveBeenCalledOnce();
    });
});
