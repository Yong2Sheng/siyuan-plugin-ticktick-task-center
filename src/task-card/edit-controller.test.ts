// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTaskBlockAttributes, type PersistedTickTickTaskData } from "../domain/task";
import { TaskCenterController } from "../task-center/task-center-controller";
import type { TaskCenterItem } from "../task-center/task-center-data";
import { TaskEditController } from "./edit-controller";

const BLOCK_ID = "20260713120000-abcdefg";
const INITIAL: PersistedTickTickTaskData = {
    version: 1,
    title: "DS9 Adaptor",
    url: "https://dida365.com/task/old",
    status: "in-progress",
    createdAt: "2026-07-12T08:30:00.000Z",
    updatedAt: "2026-07-12T09:30:00.000Z",
};

const CENTER_ITEM: TaskCenterItem = {
    blockId: BLOCK_ID,
    rootId: "20260713110000-hijklmn",
    notebookId: "20260713100000-opqrstu",
    documentTitle: "Photozpy",
    documentPath: "/Research/Photozpy",
    ...INITIAL,
};

function fields() {
    return {
        form: document.querySelector<HTMLFormElement>(".ticktick-task-edit-form")!,
        title: document.querySelector<HTMLInputElement>('[data-field="title"]')!,
        url: document.querySelector<HTMLInputElement>('[data-field="url"]')!,
        status: document.querySelector<HTMLSelectElement>('[data-field="status"]')!,
        cancel: document.querySelector<HTMLButtonElement>('[data-action="cancel"]')!,
    };
}

async function flush(): Promise<void> {
    await Promise.resolve();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
}

function createHarness(current = INITIAL) {
    const api = {
        loadAttributes: vi.fn().mockResolvedValue(createTaskBlockAttributes(current)),
        updateMarkdownBlock: vi.fn().mockResolvedValue(undefined),
        setBlockAttributes: vi.fn().mockResolvedValue(undefined),
    };
    const editor = new TaskEditController({
        translate: (key) => key,
        taskLabel: "TickTick task",
        api,
        refreshBlock: vi.fn().mockResolvedValue(true),
        warn: vi.fn(),
    });
    return { api, editor };
}

describe("TaskEditController saved result", () => {
    beforeEach(() => document.body.replaceChildren());

    it.each([
        ["status", "completed"],
        ["title", "Updated title"],
        ["url", "https://ticktick.com/task/new"],
    ] as const)("returns a successful %s edit to its caller exactly once", async (field, value) => {
        const harness = createHarness();
        const load = vi.fn().mockResolvedValue({
            items: [CENTER_ITEM],
            invalidBlocks: [],
            incompleteBlocks: [],
        });
        const center = new TaskCenterController({ load });
        await center.start();
        const onSaved = vi.fn();
        await harness.editor.open(BLOCK_ID, {
            onSaved: (saved) => {
                onSaved(saved);
                center.applyEditedTask(saved.blockId, saved.result.data);
            },
        });
        const form = fields();
        form[field].value = value;

        form.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();

        expect(onSaved).toHaveBeenCalledOnce();
        expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
            blockId: BLOCK_ID,
            result: expect.objectContaining({ changed: true }),
        }));
        expect(load).toHaveBeenCalledOnce();
        expect(center.getState().items[0]).toMatchObject({
            title: field === "title" ? value : INITIAL.title,
            url: field === "url" ? value : INITIAL.url,
            status: field === "status" ? value : INITIAL.status,
        });
        harness.editor.stop();
        center.destroy();
    });

    it("does not call onSaved for a no-change submission", async () => {
        const harness = createHarness();
        const onSaved = vi.fn();
        await harness.editor.open(BLOCK_ID, { onSaved });

        fields().form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();

        expect(onSaved).not.toHaveBeenCalled();
        harness.editor.stop();
    });

    it("does not call onSaved after a write failure or edit conflict", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const failure = createHarness();
        const failedSaved = vi.fn();
        failure.api.setBlockAttributes.mockRejectedValueOnce(new Error("write failed"));
        await failure.editor.open(BLOCK_ID, { onSaved: failedSaved });
        fields().status.value = "completed";
        fields().form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();
        expect(failedSaved).not.toHaveBeenCalled();
        failure.editor.stop();
        document.body.replaceChildren();

        const conflict = createHarness();
        const conflictSaved = vi.fn();
        conflict.api.loadAttributes
            .mockResolvedValueOnce(createTaskBlockAttributes(INITIAL))
            .mockResolvedValueOnce(createTaskBlockAttributes({
                ...INITIAL,
                updatedAt: "2026-07-13T10:30:00.000Z",
            }));
        await conflict.editor.open(BLOCK_ID, { onSaved: conflictSaved });
        fields().status.value = "completed";
        fields().form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();
        expect(conflictSaved).not.toHaveBeenCalled();
        conflict.editor.stop();
        consoleError.mockRestore();
    });

    it("does not call onSaved when the dialog is cancelled", async () => {
        const harness = createHarness();
        const onSaved = vi.fn();
        await harness.editor.open(BLOCK_ID, { onSaved });

        fields().cancel.click();
        await flush();

        expect(onSaved).not.toHaveBeenCalled();
        expect(harness.api.setBlockAttributes).not.toHaveBeenCalled();
        harness.editor.stop();
    });

    it("reuses the existing dialog and the latest caller callback", async () => {
        const harness = createHarness();
        const first = vi.fn();
        const second = vi.fn();
        await harness.editor.open(BLOCK_ID, { onSaved: first });
        await harness.editor.open(BLOCK_ID, { onSaved: second });
        expect(document.querySelectorAll(".ticktick-task-edit-form")).toHaveLength(1);

        fields().status.value = "completed";
        fields().form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();
        harness.editor.stop();
    });

    it("clears the previous caller callback when the latest open has no callback", async () => {
        const harness = createHarness();
        const previous = vi.fn();
        await harness.editor.open(BLOCK_ID, { onSaved: previous });
        await harness.editor.open(BLOCK_ID);

        fields().status.value = "completed";
        fields().form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();

        expect(previous).not.toHaveBeenCalled();
        harness.editor.stop();
    });
});
