// @vitest-environment jsdom

import type { EventBus, IProtyle } from "siyuan";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { HIDDEN_ORIGINAL_CLASS, TASK_CARD_CONTAINER_ATTRIBUTE } from "./renderer";
import { TaskCardLifecycle } from "./lifecycle";

const FIRST_ID = "20260712120000-abcdefg";
const SECOND_ID = "20260712120001-hijklmn";
const VALID_ATTRIBUTES: Record<string, unknown> = {
    [TASK_BLOCK_ATTRIBUTES.card]: "true",
    [TASK_BLOCK_ATTRIBUTES.version]: "1",
    [TASK_BLOCK_ATTRIBUTES.title]: "DS9 Adaptor",
    [TASK_BLOCK_ATTRIBUTES.url]: "https://dida365.com/task/old",
    [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
    [TASK_BLOCK_ATTRIBUTES.createdAt]: "2026-07-12T08:30:00.000Z",
    [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-07-12T09:30:00.000Z",
};

const activeLifecycles: TaskCardLifecycle[] = [];

function createBlock(): HTMLElement {
    const block = document.createElement("div");
    block.dataset.nodeId = FIRST_ID;
    block.setAttribute(TASK_BLOCK_ATTRIBUTES.card, "true");
    const original = document.createElement("div");
    original.setAttribute("contenteditable", "true");
    original.textContent = "TickTick task: DS9 Adaptor";
    const attr = document.createElement("div");
    attr.className = "protyle-attr";
    block.append(original, attr);
    return block;
}

function createLifecycle(
    root: HTMLElement,
    loadAttributes: (blockId: string) => Promise<Record<string, unknown>>,
    onEditTask = vi.fn(),
): TaskCardLifecycle {
    const eventBus = {
        on: vi.fn(),
        off: vi.fn(),
    } as unknown as EventBus;
    const lifecycle = new TaskCardLifecycle(eventBus, {
        translate: (key) => ({
            "taskCardView.status": "Status",
            "status.inProgress": "In progress",
            "status.completed": "Completed",
            "taskEdit.statusButtonTitle": "Click to edit task",
            "taskEdit.statusButtonAriaLabel": "Edit task, current status: ${status}",
        })[key] ?? key,
        loadAttributes,
        actions: { onEditTask },
        warn: vi.fn(),
    });
    lifecycle.start();
    lifecycle.refresh({ wysiwyg: { element: root } } as IProtyle);
    activeLifecycles.push(lifecycle);
    return lifecycle;
}

async function settleMutations(): Promise<void> {
    await Promise.resolve();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
}

describe("TaskCardLifecycle attribute refresh", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    afterEach(() => {
        for (const lifecycle of activeLifecycles.splice(0)) {
            lifecycle.stop();
        }
    });

    it("refreshes status text and tone once without duplicating the card", async () => {
        const root = document.createElement("div");
        const block = createBlock();
        root.append(block);
        document.body.append(root);
        let attributes = { ...VALID_ATTRIBUTES };
        const loadAttributes = vi.fn(async () => attributes);
        createLifecycle(root, loadAttributes);
        await settleMutations();

        attributes = { ...attributes, [TASK_BLOCK_ATTRIBUTES.status]: "completed" };
        block.setAttribute(TASK_BLOCK_ATTRIBUTES.status, "completed");
        await settleMutations();

        expect(block.querySelector(".ticktick-task-card__status")?.textContent).toContain("Completed");
        expect(block.querySelector(".ticktick-task-card")?.getAttribute("data-status-tone")).toBe("success");
        expect(block.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("restores Markdown when the marker is removed and enhances again when restored", async () => {
        const root = document.createElement("div");
        const block = createBlock();
        const original = block.firstElementChild as HTMLElement;
        root.append(block);
        document.body.append(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        createLifecycle(root, loadAttributes);
        await settleMutations();
        const initialCalls = loadAttributes.mock.calls.length;

        block.setAttribute(TASK_BLOCK_ATTRIBUTES.card, "false");
        await settleMutations();
        expect(block.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect(original.classList.contains(HIDDEN_ORIGINAL_CLASS)).toBe(false);
        expect(loadAttributes).toHaveBeenCalledTimes(initialCalls);

        block.setAttribute(TASK_BLOCK_ATTRIBUTES.card, "true");
        await settleMutations();
        expect(block.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
        expect(loadAttributes).toHaveBeenCalledTimes(initialCalls + 1);
    });

    it("rebinds the edit action when data-node-id changes on the same element", async () => {
        const root = document.createElement("div");
        const block = createBlock();
        root.append(block);
        document.body.append(root);
        const onEditTask = vi.fn();
        createLifecycle(root, async () => VALID_ATTRIBUTES, onEditTask);
        await settleMutations();

        block.dataset.nodeId = SECOND_ID;
        await settleMutations();
        block.querySelector<HTMLButtonElement>(".ticktick-task-card__status")?.click();

        expect(onEditTask).toHaveBeenCalledWith(SECOND_ID, { focus: "status" });
        expect(block.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("coalesces a synchronous seven-attribute update into one forced load", async () => {
        const root = document.createElement("div");
        const block = createBlock();
        root.append(block);
        document.body.append(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        createLifecycle(root, loadAttributes);
        await settleMutations();
        const initialCalls = loadAttributes.mock.calls.length;

        for (const [attribute, value] of Object.entries(VALID_ATTRIBUTES)) {
            block.setAttribute(attribute, String(value));
        }
        await settleMutations();

        expect(loadAttributes).toHaveBeenCalledTimes(initialCalls + 1);
        expect(block.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });
});
