// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { TaskCardEnhancer } from "./enhancer";
import {
    enhanceTaskBlock,
    getTaskCardDecoration,
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
    translate: (key: string) => ({
        "deadline.none": "No deadline",
        "deadline.setAction": "Set deadline",
        "deadline.editTitle": "Click to edit the deadline",
        "deadline.editAriaLabel": "Edit deadline: ${summary}, ${date}",
        "taskCenterView.openTooltip": "Open TickTick Task Center",
        "taskActions.edit": "Edit task",
        "taskActions.delete": "Delete task card",
    })[key] ?? key,
    identity: "TickTick task",
    linkText: "Open task: DS9 Adaptor ↗️",
    title: "DS9 Adaptor",
    url: "https://ticktick.com/task/1",
    workModeText: "🔎 评审-Review",
    workModeTitle: "Click to edit work category",
    workModeAriaLabel: "Edit task, current work category: 评审-Review",
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
    original.setAttribute("spellcheck", "false");
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

    it("inserts one safe card before the block while preserving original content", () => {
        const block = createBlock();
        document.body.append(block);
        const original = block.firstElementChild as HTMLElement;

        expect(enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL)).toBe(true);
        const card = getTaskCardDecoration(block);
        expect(card).not.toBeNull();
        expect(card?.nextElementSibling).toBe(block);
        expect(original.isConnected).toBe(true);
        expect(original.getAttribute("class")).toBeNull();

        const link = card?.querySelector<HTMLAnchorElement>(".ticktick-task-card__link");
        const identity = card?.querySelector<HTMLElement>(".ticktick-task-card__identity");
        const identityButton = identity?.querySelector<HTMLButtonElement>(
            ".ticktick-task-card__identity-button",
        );
        const identityIcon = identity?.querySelector<SVGSVGElement>(
            ".ticktick-task-card__identity-icon",
        );
        expect(link?.textContent).toBe(VIEW_MODEL.linkText);
        expect(link?.target).toBe("_blank");
        expect(link?.rel).toBe("noopener noreferrer");
        expect(identity?.textContent).toBe("TickTick task");
        expect(identityButton?.type).toBe("button");
        expect(identityButton?.title).toBe("Open TickTick Task Center");
        expect(identityButton?.getAttribute("aria-label")).toBe("Open TickTick Task Center");
        expect(identityIcon?.getAttribute("viewBox")).toBe("0 0 20 20");
        expect(identityIcon?.getAttribute("aria-hidden")).toBe("true");
        expect(identityIcon?.querySelectorAll("rect, path")).toHaveLength(2);
        expect(Array.from(card?.children ?? [], (child) => child.className)).toEqual([
            "ticktick-task-card__identity",
            "ticktick-task-card__main",
            "ticktick-task-card__classification",
            "ticktick-task-card__deadline",
        ]);
    });

    it("keeps the visual card completely outside the persisted block DOM", () => {
        const block = createBlock();
        document.body.append(block);
        const persistedDomBeforeEnhancement = block.outerHTML;

        expect(enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL)).toBe(true);

        expect(block.outerHTML).toBe(persistedDomBeforeEnhancement);
        for (const pluginMarker of [
            "ticktick-task-card",
            TASK_CARD_CONTAINER_ATTRIBUTE,
            "ticktick-task-card__identity",
            "ticktick-task-card__status",
        ]) {
            expect(block.outerHTML).not.toContain(pluginMarker);
        }
        expect(document.body.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("enhances a readonly SiYuan block without changing its persisted DOM", () => {
        const block = createBlock();
        const original = block.firstElementChild as HTMLElement;
        original.setAttribute("contenteditable", "false");
        original.setAttribute("spellcheck", "false");
        document.body.append(block);
        const persistedDomBeforeEnhancement = block.outerHTML;

        expect(enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL)).toBe(true);

        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(block.outerHTML).toBe(persistedDomBeforeEnhancement);
    });

    it("is idempotent when the same block is enhanced repeatedly", () => {
        const block = createBlock();
        document.body.append(block);

        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL);
        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL);
        expect(document.body.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("removes the card and restores original content", () => {
        const block = createBlock();
        document.body.append(block);
        const original = block.firstElementChild as HTMLElement;
        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL);

        restoreTaskBlock(block);
        expect(getTaskCardDecoration(block)).toBeNull();
        expect(original.textContent).toBe("TickTick task: DS9 Adaptor");
    });

    it("stacks work category above status and keeps separate edit entries", () => {
        const block = createBlock();
        document.body.append(block);
        const onEditTask = vi.fn();
        const onOpenTaskCenter = vi.fn();

        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL, {
            onEditTask,
            onOpenTaskCenter,
        });
        const card = getTaskCardDecoration(block)!;
        const identityButton = card.querySelector<HTMLButtonElement>(
            ".ticktick-task-card__identity-button",
        )!;
        const statusButtons = card.querySelectorAll<HTMLButtonElement>(".ticktick-task-card__status");
        const status = statusButtons[0];
        const workMode = card.querySelector<HTMLButtonElement>(".ticktick-task-card__work-mode")!;
        const classification = card.querySelector<HTMLElement>(".ticktick-task-card__classification")!;
        const deadline = card.querySelector<HTMLButtonElement>(".ticktick-task-card__deadline")!;

        expect(card.querySelector(".ticktick-task-card__edit")).toBeNull();
        expect(Array.from(card.querySelectorAll("button"), (button) => button.textContent))
            .not.toContain("✏️ Edit");
        expect(statusButtons).toHaveLength(1);
        expect(workMode.textContent).toBe("🔎 评审-Review");
        expect(Array.from(classification.children)).toEqual([workMode, status]);
        expect(status.tagName).toBe("BUTTON");
        expect(status.type).toBe("button");
        expect(status.textContent).toBe("Status: ▶️ In progress");
        expect(status.title).toBe("Click to edit task");
        expect(status.getAttribute("aria-label")).toBe("Edit task, current status: In progress");
        expect(deadline.querySelector(".ticktick-task-card__deadline-summary")?.textContent)
            .toBe("No deadline");
        expect(deadline.querySelectorAll(".ticktick-task-card__deadline-segment")).toHaveLength(8);

        identityButton.click();
        deadline.click();
        workMode.click();
        status.click();
        expect(onOpenTaskCenter).toHaveBeenCalledOnce();
        expect(onEditTask).toHaveBeenCalledTimes(3);
        expect(onEditTask).toHaveBeenNthCalledWith(1, block.dataset.nodeId, { focus: "deadline" });
        expect(onEditTask).toHaveBeenCalledWith(block.dataset.nodeId, { focus: "work-mode" });
        expect(onEditTask).toHaveBeenCalledWith(block.dataset.nodeId, { focus: "status" });
    });

    it("opens task actions when right-clicking an inner card button", () => {
        const block = createBlock();
        document.body.append(block);
        const onEditTask = vi.fn();
        const onDeleteTask = vi.fn();

        enhanceTaskBlock(block, block.dataset.nodeId!, VIEW_MODEL, {
            onEditTask,
            onDeleteTask,
        });
        const status = getTaskCardDecoration(block)!
            .querySelector<HTMLButtonElement>(".ticktick-task-card__status")!;
        const contextMenu = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 80,
        });

        status.dispatchEvent(contextMenu);

        expect(contextMenu.defaultPrevented).toBe(true);
        const items = Array.from(document.querySelectorAll<HTMLButtonElement>(".b3-menu__item"));
        expect(items.map((item) => item.textContent)).toEqual(["Edit task", "Delete task card"]);
        items[0]?.click();
        items[1]?.click();
        expect(onEditTask).toHaveBeenCalledWith(block.dataset.nodeId, { focus: "status" });
        expect(onDeleteTask).toHaveBeenCalledWith(block.dataset.nodeId, VIEW_MODEL.title);
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

        const card = getTaskCardDecoration(block)!;
        expect(document.body.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
        expect(card.querySelectorAll(".ticktick-task-card__status")).toHaveLength(1);
        expect(card.querySelector<HTMLAnchorElement>(".ticktick-task-card__link")?.href)
            .toBe("https://ticktick.com/task/updated");
        expect(card.querySelector(".ticktick-task-card__link")?.textContent).toContain("Updated task");
        expect(card.querySelector(".ticktick-task-card__status")?.textContent).toContain("Completed");
        expect(card.getAttribute("data-status-tone"))
            .toBe("success");
    });

    it("restores Markdown when forced refresh reads invalid attributes", async () => {
        const block = createBlock();
        document.body.append(block);
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

        expect(getTaskCardDecoration(block)).toBeNull();
    });

    it("restores Markdown when forced attribute loading fails", async () => {
        const block = createBlock();
        document.body.append(block);
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

        expect(getTaskCardDecoration(block)).toBeNull();
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
        const forcedRefresh = enhancer.enhanceKnownBlock(block, true);
        resolveInitial(VALID_ATTRIBUTES);
        await Promise.all([ordinaryEnhancement, forcedRefresh]);

        expect(loadAttributes).toHaveBeenCalledTimes(2);
        expect(getTaskCardDecoration(block)?.querySelector(".ticktick-task-card__status")?.textContent)
            .toContain("Completed");
        expect(document.body.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("allows only one in-flight enhancement for concurrent requests to the same block", async () => {
        const block = createBlock();
        document.body.append(block);
        let resolveAttributes!: (attributes: Record<string, unknown>) => void;
        const attributes = new Promise<Record<string, unknown>>((resolve) => {
            resolveAttributes = resolve;
        });
        const loadAttributes = vi.fn(() => attributes);
        const onEditTask = vi.fn();
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes,
            actions: { onEditTask },
        });

        const first = enhancer.enhanceKnownBlock(block);
        const second = enhancer.enhanceKnownBlock(block);
        await Promise.resolve();
        expect(loadAttributes).toHaveBeenCalledOnce();

        resolveAttributes(VALID_ATTRIBUTES);
        await Promise.all([first, second]);

        expect(loadAttributes).toHaveBeenCalledOnce();
        expect(document.body.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
        getTaskCardDecoration(block)
            ?.querySelector<HTMLButtonElement>(".ticktick-task-card__status")?.click();
        expect(onEditTask).toHaveBeenCalledOnce();
    });

    it("shares one forced data refresh across two DOM instances and renders both", async () => {
        const first = createBlock();
        const second = createBlock();
        document.body.append(first, second);
        let resolveAttributes!: (attributes: Record<string, unknown>) => void;
        const attributes = new Promise<Record<string, unknown>>((resolve) => {
            resolveAttributes = resolve;
        });
        const loadAttributes = vi.fn(() => attributes);
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes,
        });

        const firstRefresh = enhancer.enhanceKnownBlock(first, true);
        const secondRefresh = enhancer.enhanceKnownBlock(second, true);
        await Promise.resolve();
        expect(loadAttributes).toHaveBeenCalledOnce();
        resolveAttributes(VALID_ATTRIBUTES);
        await Promise.all([firstRefresh, secondRefresh]);

        expect(loadAttributes).toHaveBeenCalledOnce();
        expect(getTaskCardDecoration(first)).not.toBeNull();
        expect(getTaskCardDecoration(second)).not.toBeNull();
    });

    it("does not render or repair when stopped during an in-flight attribute load", async () => {
        const block = createBlock();
        document.body.append(block);
        let resolveAttributes!: (attributes: Record<string, unknown>) => void;
        const attributes = new Promise<Record<string, unknown>>((resolve) => {
            resolveAttributes = resolve;
        });
        const repairMarkdown = vi.fn(async () => undefined);
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes: vi.fn(() => attributes),
            repairMarkdown,
        });

        const enhancement = enhancer.enhanceKnownBlock(block);
        enhancer.stop();
        resolveAttributes(VALID_ATTRIBUTES);
        await enhancement;

        expect(getTaskCardDecoration(block)).toBeNull();
        expect(repairMarkdown).not.toHaveBeenCalled();
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
        expect(getTaskCardDecoration(bad)).toBeNull();
        expect(getTaskCardDecoration(valid)).not.toBeNull();
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
        expect(getTaskCardDecoration(block)).not.toBeNull();
    });
});
