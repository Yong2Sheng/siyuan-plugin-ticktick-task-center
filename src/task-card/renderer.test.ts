// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES, TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
import { createTaskCardViewModel } from "./card-view-model";
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
        "deadline.closed": "Closed",
        "deadline.setAction": "Set deadline",
        "deadline.editTitle": "Click to edit the deadline",
        "deadline.editAriaLabel": "Edit deadline: ${summary}, ${date}",
        "taskCenterView.openTooltip": "Open SiYuan Task Center",
        "taskActions.edit": "Edit task",
        "taskActions.delete": "Delete task card",
        "taskCenterView.dailyProgressAction": "🚀 Push today",
        "taskCenterView.dailyProgressDone": "✨ Pushed today",
        "taskCenterView.dailyProgressTitle": "Mark today as pushed",
        "taskCenterView.dailyProgressUndoTitle": "Undo today's push",
        "priority.high": "Must advance",
        "priority.normal": "Normal",
        "priority.low": "When free",
        "priority.unset": "Not set",
        "priority.unsetAction": "➖ Set weight",
        "priority.menuTitle": "Set task weight",
    })[key] ?? key,
    identity: "SiYuan task",
    linkText: "Open TickTick: DS9 Adaptor ↗️",
    title: "DS9 Adaptor",
    url: "https://ticktick.com/task/1",
    target: { kind: "ticktick" as const, url: "https://ticktick.com/task/1" },
    workModeText: "🔎 评审-Review",
    workModeTitle: "Click to edit work category",
    workModeAriaLabel: "Edit task, current work category: 评审-Review",
    statusText: "Status: ▶️ In progress",
    statusTitle: "Click to edit task",
    statusAriaLabel: "Edit task, current status: In progress",
    statusTone: "primary" as const,
    statusTerminal: false,
    priorityText: "🔥 必须推进",
    priorityTitle: "设置任务权重",
    priority: "high" as const,
    priorityConfigured: true,
    progressedToday: false,
};

const LINKLESS_VIEW_MODEL = {
    ...VIEW_MODEL,
    linkText: "DS9 Adaptor",
    url: "",
    target: undefined,
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
        expect(identity?.textContent).toBe("SiYuan task");
        expect(identityButton?.type).toBe("button");
        expect(identityButton?.title).toBe("Open SiYuan Task Center");
        expect(identityButton?.getAttribute("aria-label")).toBe("Open SiYuan Task Center");
        expect(identityIcon?.getAttribute("viewBox")).toBe("0 0 20 20");
        expect(identityIcon?.getAttribute("aria-hidden")).toBe("true");
        expect(identityIcon?.querySelectorAll("rect, path")).toHaveLength(2);
        expect(Array.from(card?.children ?? [], (child) => child.className)).toEqual([
            "ticktick-task-card__identity",
            "ticktick-task-card__main",
            "ticktick-task-card__classification",
            "ticktick-task-card__deadline-column",
        ]);
    });

    it("uses an internal button for SiYuan targets", () => {
        const block = createBlock();
        document.body.append(block);
        const onOpenSiYuanTarget = vi.fn();
        const blockId = "20260825232625-2gpb83i";

        enhanceTaskBlock(block, block.dataset.nodeId!, {
            ...VIEW_MODEL,
            url: `siyuan://blocks/${blockId}`,
            target: { kind: "siyuan-block", url: `siyuan://blocks/${blockId}`, blockId },
            linkText: "Open SiYuan document: Writing project ↗️",
        }, {
            onEditTask: vi.fn(),
            onOpenSiYuanTarget,
        });

        const target = getTaskCardDecoration(block)!
            .querySelector<HTMLButtonElement>(".ticktick-task-card__link")!;
        expect(target.tagName).toBe("BUTTON");
        expect(target.type).toBe("button");
        expect(target.getAttribute("href")).toBeNull();
        target.click();
        expect(onOpenSiYuanTarget).toHaveBeenCalledWith(blockId);
    });

    it("renders plain text instead of a link control when the task has no target", () => {
        const block = createBlock();
        document.body.append(block);

        expect(enhanceTaskBlock(block, block.dataset.nodeId!, LINKLESS_VIEW_MODEL)).toBe(true);

        const target = getTaskCardDecoration(block)!
            .querySelector<HTMLElement>(".ticktick-task-card__link")!;
        // 少一个控件，而不是留一个点不动的灰按钮
        expect(target.tagName).toBe("SPAN");
        expect(target.classList.contains("ticktick-task-card__link--plain")).toBe(true);
        expect(target.textContent).toBe("DS9 Adaptor");
        expect(target.getAttribute("href")).toBeNull();
        // 状态与工作分类仍然可编辑
        expect(getTaskCardDecoration(block)!
            .querySelector<HTMLButtonElement>(".ticktick-task-card__status")?.type).toBe("button");
    });

    it("does not mark a completed task with a past deadline as overdue", () => {
        const block = createBlock();
        document.body.append(block);

        expect(enhanceTaskBlock(block, block.dataset.nodeId!, {
            ...VIEW_MODEL,
            deadline: "2020-01-01",
            statusTerminal: true,
        })).toBe(true);

        const card = getTaskCardDecoration(block)!;
        expect(card.dataset.deadlineState).toBe("closed");
        expect(card.querySelector<HTMLElement>(".ticktick-task-card__deadline")?.dataset.deadlineState)
            .toBe("closed");
        expect(card.querySelector(".ticktick-task-card__deadline-summary")?.textContent)
            .toBe("Closed");
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

    it("stacks work category, status and weight while keeping the deadline standalone", () => {
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
        const priority = card.querySelector<HTMLButtonElement>(".ticktick-task-card__priority")!;
        const deadline = card.querySelector<HTMLButtonElement>(".ticktick-task-card__deadline")!;

        expect(card.querySelector(".ticktick-task-card__edit")).toBeNull();
        expect(Array.from(card.querySelectorAll("button"), (button) => button.textContent))
            .not.toContain("✏️ Edit");
        expect(statusButtons).toHaveLength(1);
        expect(workMode.textContent).toBe("🔎 评审-Review");
        // 分类列竖向：工作分类 → 状态 → 权重。
        expect(Array.from(classification.children)).toEqual([workMode, status, priority]);
        // 截止日期在自己的列里，保持原有尺寸；该用例没有推进动作，所以列里只有它。
        const deadlineColumn = card.querySelector<HTMLElement>(".ticktick-task-card__deadline-column")!;
        expect(Array.from(deadlineColumn.children)).toEqual([deadline]);
        expect(priority.dataset.priority).toBe("high");
        expect(priority.textContent).toBe("🔥 必须推进");
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

describe("document card daily progress control", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    /** 用真实视图模型构造卡片，避免手写字段漏掉新增项。 */
    function renderCard(
        attributes: Record<string, unknown>,
        actions: Parameters<typeof enhanceTaskBlock>[3],
        options: { lastProgressedDate?: string; today?: string } = {},
    ): HTMLElement {
        const block = createBlock();
        document.body.append(block);
        const data = {
            version: 1 as const,
            title: "DS9 Adaptor",
            url: "https://dida365.com/task/1",
            status: (attributes[TASK_BLOCK_ATTRIBUTES.status] ?? "in-progress") as "in-progress" | "completed",
            createdAt: "2026-07-12T08:30:00.000Z",
            updatedAt: "2026-07-12T09:30:00.000Z",
            ...(attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]
                ? { priority: attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority] as "high" }
                : {}),
        };
        enhanceTaskBlock(
            block,
            block.dataset.nodeId!,
            createTaskCardViewModel(data, VIEW_MODEL.translate, options),
            actions,
        );
        return getTaskCardDecoration(block)!;
    }

    it("shows an actionable control for a task that has not been pushed today", () => {
        const card = renderCard({}, { onEditTask: vi.fn(), onToggleDailyProgress: vi.fn() });
        const button = card.querySelector<HTMLButtonElement>(".ticktick-task-card__progress")!;
        expect(button.textContent).toBe("🚀 Push today");
        expect(button.dataset.progressedToday).toBe("false");
        expect(button.disabled).toBe(false);
    });

    it("marks the pushed state for a task already recorded today", () => {
        const card = renderCard({}, { onEditTask: vi.fn(), onToggleDailyProgress: vi.fn() }, {
            lastProgressedDate: "2026-09-08",
            today: "2026-09-08",
        });
        const button = card.querySelector<HTMLButtonElement>(".ticktick-task-card__progress")!;
        expect(button.textContent).toBe("✨ Pushed today");
        expect(button.dataset.progressedToday).toBe("true");
        expect(button.getAttribute("aria-pressed")).toBe("true");
    });

    it("writes today when pushed and clears it when undone", () => {
        const onToggleDailyProgress = vi.fn().mockResolvedValue(undefined);
        const card = renderCard({}, { onEditTask: vi.fn(), onToggleDailyProgress });
        const button = card.querySelector<HTMLButtonElement>(".ticktick-task-card__progress")!;
        button.click();
        expect(onToggleDailyProgress).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        );
        // 写入未返回前禁用，避免重复提交。
        expect(button.disabled).toBe(true);
    });

    it("undoes the pushed state with undefined", () => {
        const onToggleDailyProgress = vi.fn().mockResolvedValue(undefined);
        const card = renderCard({}, { onEditTask: vi.fn(), onToggleDailyProgress }, {
            lastProgressedDate: "2026-09-08",
            today: "2026-09-08",
        });
        card.querySelector<HTMLButtonElement>(".ticktick-task-card__progress")!.click();
        expect(onToggleDailyProgress).toHaveBeenCalledWith(expect.any(String), undefined);
    });

    it("does not offer the control for a closed task", () => {
        const card = renderCard(
            { [TASK_BLOCK_ATTRIBUTES.status]: "completed" },
            { onEditTask: vi.fn(), onToggleDailyProgress: vi.fn() },
        );
        expect(card.querySelector(".ticktick-task-card__progress")).toBeNull();
    });

    it("restores the button and reports the error when the write fails", async () => {
        const error = new Error("write failed");
        const onToggleDailyProgress = vi.fn().mockRejectedValue(error);
        const onDailyProgressError = vi.fn();
        const card = renderCard({}, { onEditTask: vi.fn(), onToggleDailyProgress, onDailyProgressError });
        const button = card.querySelector<HTMLButtonElement>(".ticktick-task-card__progress")!;
        button.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(onDailyProgressError).toHaveBeenCalledWith(error);
        expect(button.disabled).toBe(false);
    });

    it("shows the configured weight on the card", () => {
        const card = renderCard(
            { [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: "high" },
            { onEditTask: vi.fn(), onSavePriority: vi.fn() },
        );
        const badge = card.querySelector<HTMLButtonElement>(".ticktick-task-card__priority")!;
        expect(badge.dataset.priority).toBe("high");
    });

    it("shows the unset weight action when no level is stored", () => {
        const card = renderCard({}, { onEditTask: vi.fn(), onSavePriority: vi.fn() });
        const badge = card.querySelector<HTMLButtonElement>(".ticktick-task-card__priority")!;
        expect(badge.dataset.priority).toBe("unset");
    });
});

describe("document card deadline column", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    function render(attributes: Record<string, unknown>, actions: Parameters<typeof enhanceTaskBlock>[3]) {
        const block = createBlock();
        document.body.append(block);
        enhanceTaskBlock(
            block,
            block.dataset.nodeId!,
            createTaskCardViewModel({
                version: 1,
                title: "DS9 Adaptor",
                url: "https://dida365.com/task/1",
                status: (attributes[TASK_BLOCK_ATTRIBUTES.status] ?? "in-progress") as "in-progress",
                createdAt: "2026-07-12T08:30:00.000Z",
                updatedAt: "2026-07-12T09:30:00.000Z",
            }, VIEW_MODEL.translate),
            actions,
        );
        return getTaskCardDecoration(block)!;
    }

    it("puts the daily progress button under the deadline instead of beside it", () => {
        const card = render({}, { onEditTask: vi.fn(), onToggleDailyProgress: vi.fn() });
        const column = card.querySelector<HTMLElement>(".ticktick-task-card__deadline-column")!;
        const deadline = card.querySelector<HTMLElement>(".ticktick-task-card__deadline")!;
        const progress = card.querySelector<HTMLElement>(".ticktick-task-card__progress")!;

        expect(Array.from(column.children)).toEqual([deadline, progress]);
        // 推进按钮不再作为卡片的直接子元素出现在右侧。
        expect(Array.from(card.children)).not.toContain(progress);
    });

    it("keeps only the deadline in the column for a closed task", () => {
        const card = render(
            { [TASK_BLOCK_ATTRIBUTES.status]: "completed" },
            { onEditTask: vi.fn(), onToggleDailyProgress: vi.fn() },
        );
        const column = card.querySelector<HTMLElement>(".ticktick-task-card__deadline-column")!;
        expect(column.querySelector(".ticktick-task-card__progress")).toBeNull();
        expect(column.children).toHaveLength(1);
    });

    it("leaves a single deadline in the column when no progress handler is wired", () => {
        const card = render({}, { onEditTask: vi.fn() });
        const column = card.querySelector<HTMLElement>(".ticktick-task-card__deadline-column")!;
        expect(column.children).toHaveLength(1);
    });
});
