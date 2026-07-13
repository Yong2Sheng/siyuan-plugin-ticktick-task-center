// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PersistedTickTickTaskData } from "../domain/task";
import { showEditTaskDialog } from "./edit-task-form";

const INITIAL: PersistedTickTickTaskData = {
    version: 1,
    title: "DS9 Adaptor",
    url: "https://dida365.com/task/old",
    status: "in-progress",
    createdAt: "2026-07-12T08:30:00.000Z",
    updatedAt: "2026-07-12T09:30:00.000Z",
};

const translate = (key: string): string => key;

function elements(root: ParentNode) {
    return {
        form: root.querySelector<HTMLFormElement>("form")!,
        title: root.querySelector<HTMLInputElement>('[data-field="title"]')!,
        url: root.querySelector<HTMLInputElement>('[data-field="url"]')!,
        status: root.querySelector<HTMLSelectElement>('[data-field="status"]')!,
        cancel: root.querySelector<HTMLButtonElement>('[data-action="cancel"]')!,
        save: root.querySelector<HTMLButtonElement>('[data-action="save"]')!,
        error: root.querySelector<HTMLElement>('[data-field="error"]')!,
    };
}

async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe("showEditTaskDialog", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("prefills title, URL and status and focuses status for the status intent", () => {
        const handle = showEditTaskDialog({
            translate,
            initial: INITIAL,
            onSave: vi.fn(async () => ({ changed: false, data: INITIAL })),
        });
        const fields = elements(handle.dialog.element);

        expect(fields.title.value).toBe(INITIAL.title);
        expect(fields.url.value).toBe(INITIAL.url);
        expect(fields.status.value).toBe(INITIAL.status);
        handle.focusStatus();
        expect(document.activeElement).toBe(fields.status);
    });

    it("disables every control while saving and ignores duplicate submits", async () => {
        let resolveSave!: () => void;
        const onSave = vi.fn(() => new Promise<{ changed: true; data: PersistedTickTickTaskData }>((resolve) => {
            resolveSave = () => resolve({ changed: true, data: INITIAL });
        }));
        const handle = showEditTaskDialog({ translate, initial: INITIAL, onSave });
        const fields = elements(handle.dialog.element);

        fields.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        fields.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();

        expect(fields.title.disabled).toBe(true);
        expect(fields.url.disabled).toBe(true);
        expect(fields.status.disabled).toBe(true);
        expect(fields.cancel.disabled).toBe(true);
        expect(fields.save.disabled).toBe(true);
        expect(onSave).toHaveBeenCalledOnce();
        resolveSave();
        await flush();
    });

    it("reenables controls and preserves input after a save failure", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const onSave = vi.fn().mockRejectedValue(new Error("failed"));
        const handle = showEditTaskDialog({ translate, initial: INITIAL, onSave });
        const fields = elements(handle.dialog.element);
        fields.title.value = "User input";

        fields.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();

        expect(fields.title.disabled).toBe(false);
        expect(fields.url.disabled).toBe(false);
        expect(fields.status.disabled).toBe(false);
        expect(fields.cancel.disabled).toBe(false);
        expect(fields.save.disabled).toBe(false);
        expect(fields.title.value).toBe("User input");
    });

    it("keeps invalid user input and does not call the write callback", async () => {
        const onSave = vi.fn(async () => ({ changed: false as const, data: INITIAL }));
        const handle = showEditTaskDialog({ translate, initial: INITIAL, onSave });
        const fields = elements(handle.dialog.element);
        fields.title.value = "   ";
        fields.url.value = "http://example.com";

        fields.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();

        expect(onSave).not.toHaveBeenCalled();
        expect(fields.title.value).toBe("   ");
        expect(fields.url.value).toBe("http://example.com");
        expect(fields.error.classList.contains("fn__none")).toBe(false);
    });

    it("does not save after cancellation or destruction", async () => {
        const onSave = vi.fn(async () => ({ changed: false as const, data: INITIAL }));
        const cancelled = showEditTaskDialog({ translate, initial: INITIAL, onSave });
        elements(cancelled.dialog.element).cancel.click();

        const destroyed = showEditTaskDialog({ translate, initial: INITIAL, onSave });
        const staleForm = elements(destroyed.dialog.element).form;
        destroyed.destroy();
        staleForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();

        expect(onSave).not.toHaveBeenCalled();
    });
});
