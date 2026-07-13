// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { TaskCardEnhancer } from "./enhancer";
import {
    enhanceTaskBlock,
    HIDDEN_ORIGINAL_CLASS,
    restoreTaskBlock,
    TASK_CARD_CONTAINER_ATTRIBUTE,
} from "./renderer";

const VALID_ATTRIBUTES: Record<string, unknown> = {
    [TASK_BLOCK_ATTRIBUTES.card]: "true",
    [TASK_BLOCK_ATTRIBUTES.version]: "1",
    [TASK_BLOCK_ATTRIBUTES.title]: "DS9 Adaptor",
    [TASK_BLOCK_ATTRIBUTES.url]: "https://dida365.com/webapp/#p/1/tasks/2",
    [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
    [TASK_BLOCK_ATTRIBUTES.createdAt]: "2026-07-12T08:30:00.000Z",
    [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-07-12T09:30:00.000Z",
};

const VIEW_MODEL = {
    identity: "✅ TickTick task",
    linkText: "Open task: DS9 Adaptor ↗️",
    title: "DS9 Adaptor",
    url: "https://ticktick.com/task/1",
    statusText: "Status: ▶️ In progress",
    statusTitle: "Click to edit task",
    statusAriaLabel: "Edit task, current status: In progress",
    statusTone: "primary" as const,
};

function createBlock(id = "20260712120000-abcdefg", task = true): HTMLElement {
    const block = document.createElement("div");
    block.dataset.nodeId = id;
    if (task) {
        block.setAttribute(TASK_BLOCK_ATTRIBUTES.card, "true");
    }

    const original = document.createElement("div");
    original.setAttribute("contenteditable", "true");
    original.textContent = "TickTick task: DS9 Adaptor";
    const attrs = document.createElement("div");
    attrs.className = "protyle-attr";
    block.append(original, attrs);
    return block;
}

describe("task card renderer", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it("inserts one safe card while preserving and visually hiding original content", () => {
        const block = createBlock();
        document.body.append(block);
        const original = block.firstElementChild as HTMLElement;

        expect(enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL)).toBe(true);
        expect(block.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
        expect(original.isConnected).toBe(true);
        expect(original.classList.contains(HIDDEN_ORIGINAL_CLASS)).toBe(true);

        const link = block.querySelector<HTMLAnchorElement>(".ticktick-task-card__link");
        expect(link?.textContent).toBe(VIEW_MODEL.linkText);
        expect(link?.target).toBe("_blank");
        expect(link?.rel).toBe("noopener noreferrer");
    });

    it("is idempotent when the same block is enhanced repeatedly", () => {
        const block = createBlock();
        document.body.append(block);

        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL);
        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL);
        expect(block.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("removes the card and restores original content", () => {
        const block = createBlock();
        document.body.append(block);
        const original = block.firstElementChild as HTMLElement;
        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL);

        restoreTaskBlock(block);
        expect(block.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect(original.classList.contains(HIDDEN_ORIGINAL_CLASS)).toBe(false);
        expect(original.textContent).toBe("TickTick task: DS9 Adaptor");
    });

    it("uses the status button as the only accessible edit entry", () => {
        const block = createBlock();
        document.body.append(block);
        const onEditTask = vi.fn();

        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL, { onEditTask });
        const statusButtons = block.querySelectorAll<HTMLButtonElement>(".ticktick-task-card__status");
        const status = statusButtons[0];

        expect(block.querySelector(".ticktick-task-card__edit")).toBeNull();
        expect(Array.from(block.querySelectorAll("button"), (button) => button.textContent))
            .not.toContain("✏️ Edit");
        expect(statusButtons).toHaveLength(1);
        expect(status.tagName).toBe("BUTTON");
        expect(status.type).toBe("button");
        expect(status.textContent).toBe("Status: ▶️ In progress");
        expect(status.title).toBe("Click to edit task");
        expect(status.getAttribute("aria-label")).toBe("Edit task, current status: In progress");

        status.click();
        expect(onEditTask).toHaveBeenCalledOnce();
        expect(onEditTask).toHaveBeenCalledWith(block.dataset.nodeId, { focus: "status" });
    });

    it("refreshes an existing card without duplicating it", async () => {
        const block = createBlock();
        document.body.append(block);
        const loadAttributes = vi.fn()
            .mockResolvedValueOnce(VALID_ATTRIBUTES)
            .mockResolvedValueOnce({
                ...VALID_ATTRIBUTES,
                [TASK_BLOCK_ATTRIBUTES.title]: "Updated task",
                [TASK_BLOCK_ATTRIBUTES.url]: "https://ticktick.com/task/updated",
                [TASK_BLOCK_ATTRIBUTES.status]: "completed",
            });
        const enhancer = new TaskCardEnhancer({
            translate: (key) => ({
                "taskCardView.openTask": "Open task",
                "taskCardView.status": "Status",
                "status.completed": "Completed",
            })[key] ?? key,
            loadAttributes,
        });

        await enhancer.enhanceKnownBlock(block);
        await enhancer.enhanceKnownBlock(block, true);

        expect(block.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
        expect(block.querySelectorAll(".ticktick-task-card__status")).toHaveLength(1);
        expect(block.querySelector<HTMLAnchorElement>(".ticktick-task-card__link")?.href)
            .toBe("https://ticktick.com/task/updated");
        expect(block.querySelector(".ticktick-task-card__link")?.textContent).toContain("Updated task");
        expect(block.querySelector(".ticktick-task-card__status")?.textContent).toContain("Completed");
        expect(block.querySelector(".ticktick-task-card")?.getAttribute("data-status-tone"))
            .toBe("success");
    });

    it("restores Markdown when forced refresh reads invalid attributes", async () => {
        const block = createBlock();
        document.body.append(block);
        const original = block.firstElementChild as HTMLElement;
        const loadAttributes = vi.fn()
            .mockResolvedValueOnce(VALID_ATTRIBUTES)
            .mockResolvedValueOnce({
                ...VALID_ATTRIBUTES,
                [TASK_BLOCK_ATTRIBUTES.status]: "invalid",
            });
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes,
            warn: vi.fn(),
        });

        await enhancer.enhanceKnownBlock(block);
        await enhancer.enhanceKnownBlock(block, true);

        expect(block.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect(original.classList.contains(HIDDEN_ORIGINAL_CLASS)).toBe(false);
    });

    it("restores Markdown when forced attribute loading fails", async () => {
        const block = createBlock();
        document.body.append(block);
        const original = block.firstElementChild as HTMLElement;
        const loadAttributes = vi.fn()
            .mockResolvedValueOnce(VALID_ATTRIBUTES)
            .mockRejectedValueOnce(new Error("load failed"));
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes,
            warn: vi.fn(),
        });

        await enhancer.enhanceKnownBlock(block);
        await enhancer.enhanceKnownBlock(block, true);

        expect(block.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect(original.classList.contains(HIDDEN_ORIGINAL_CLASS)).toBe(false);
    });

    it("runs a queued forced refresh after an ordinary enhancement finishes", async () => {
        const block = createBlock();
        document.body.append(block);
        let resolveInitial!: (attributes: Record<string, unknown>) => void;
        const initial = new Promise<Record<string, unknown>>((resolve) => {
            resolveInitial = resolve;
        });
        const loadAttributes = vi.fn()
            .mockReturnValueOnce(initial)
            .mockResolvedValueOnce({
                ...VALID_ATTRIBUTES,
                [TASK_BLOCK_ATTRIBUTES.status]: "completed",
            });
        const enhancer = new TaskCardEnhancer({
            translate: (key) => ({
                "taskCardView.status": "Status",
                "status.completed": "Completed",
            })[key] ?? key,
            loadAttributes,
        });

        const ordinaryEnhancement = enhancer.enhanceKnownBlock(block);
        await enhancer.enhanceKnownBlock(block, true);
        resolveInitial(VALID_ATTRIBUTES);
        await ordinaryEnhancement;

        expect(loadAttributes).toHaveBeenCalledTimes(2);
        expect(block.querySelector(".ticktick-task-card__status")?.textContent).toContain("Completed");
        expect(block.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("leaves a bad task visible while enhancing another valid task", async () => {
        const bad = createBlock("20260712120000-badattr");
        const valid = createBlock("20260712120000-goodone");
        document.body.append(bad, valid);
        const loadAttributes = vi.fn(async (blockId: string) => blockId.endsWith("badattr")
            ? { ...VALID_ATTRIBUTES, [TASK_BLOCK_ATTRIBUTES.title]: "" }
            : VALID_ATTRIBUTES);
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes,
            warn: vi.fn(),
        });

        await enhancer.scan(document.body);
        expect(bad.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect((bad.firstElementChild as HTMLElement).classList.contains(HIDDEN_ORIGINAL_CLASS)).toBe(false);
        expect(valid.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).not.toBeNull();
    });

    it("does not request attributes for ordinary paragraphs", async () => {
        const ordinary = createBlock("20260712120000-ordinary", false);
        document.body.append(ordinary);
        const loadAttributes = vi.fn();
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes,
        });

        await enhancer.scan(document.body);
        expect(loadAttributes).not.toHaveBeenCalled();
    });

    it("can enhance a newly created known block before its DOM marker is synchronized", async () => {
        const block = createBlock("20260712120000-newtask", false);
        document.body.append(block);
        const loadAttributes = vi.fn().mockResolvedValue(VALID_ATTRIBUTES);
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes,
        });

        await enhancer.enhanceKnownBlock(block);
        expect(loadAttributes).toHaveBeenCalledWith("20260712120000-newtask");
        expect(block.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).not.toBeNull();
    });
});
