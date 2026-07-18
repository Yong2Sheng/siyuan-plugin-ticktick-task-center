// @vitest-environment jsdom

import type { EventBus, IProtyle, Protyle } from "siyuan";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { TaskCardLifecycle } from "./lifecycle";
import { getTaskCardDecoration, TASK_CARD_CONTAINER_ATTRIBUTE } from "./renderer";

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

type ProtyleEventName =
    | "loaded-protyle-static"
    | "loaded-protyle-dynamic"
    | "switch-protyle"
    | "switch-protyle-mode"
    | "destroy-protyle";

type ProtyleListener = (event: CustomEvent<{ protyle: IProtyle }>) => void;

class TestEventBus {
    private readonly listeners = new Map<ProtyleEventName, Set<ProtyleListener>>();

    readonly on = vi.fn((name: ProtyleEventName, listener: ProtyleListener) => {
        const listeners = this.listeners.get(name) ?? new Set<ProtyleListener>();
        listeners.add(listener);
        this.listeners.set(name, listeners);
    });

    readonly off = vi.fn((name: ProtyleEventName, listener: ProtyleListener) => {
        this.listeners.get(name)?.delete(listener);
    });

    emit(name: ProtyleEventName, protyle: IProtyle): void {
        const event = new CustomEvent("protyle", { detail: { protyle } });
        for (const listener of this.listeners.get(name) ?? []) {
            listener(event);
        }
    }
}

const activeLifecycles: TaskCardLifecycle[] = [];

function createBlock(
    id = FIRST_ID,
    marker: "true" | "false" | null = "true",
    readonly = false,
): HTMLElement {
    const block = document.createElement("div");
    block.dataset.nodeId = id;
    for (const [attribute, value] of Object.entries(VALID_ATTRIBUTES)) {
        block.setAttribute(attribute, String(value));
    }
    if (marker === null) {
        block.removeAttribute(TASK_BLOCK_ATTRIBUTES.card);
    } else {
        block.setAttribute(TASK_BLOCK_ATTRIBUTES.card, marker);
    }

    const original = document.createElement("div");
    original.setAttribute("contenteditable", readonly ? "false" : "true");
    original.setAttribute("spellcheck", "false");
    original.textContent = "TickTick task: DS9 Adaptor";
    const attr = document.createElement("div");
    attr.className = "protyle-attr";
    block.append(original, attr);
    return block;
}

function createProtyleRoot(...blocks: HTMLElement[]): HTMLDivElement {
    const root = document.createElement("div");
    root.className = "protyle-wysiwyg";
    root.append(...blocks);
    return root;
}

function asProtyle(root: HTMLElement): IProtyle {
    return { wysiwyg: { element: root } } as IProtyle;
}

function mountProtyle(root: HTMLElement): { content: HTMLElement; protyle: IProtyle } {
    const protyleElement = document.createElement("div");
    protyleElement.className = "protyle";
    const content = document.createElement("div");
    content.className = "protyle-content";
    content.append(root);
    protyleElement.append(content);
    document.body.append(protyleElement);
    const protyle = {
        element: protyleElement,
        contentElement: content,
        wysiwyg: { element: root },
        disabled: root.getAttribute("data-readonly") === "true",
    } as unknown as IProtyle;
    return { content, protyle };
}

function createLifecycleHarness(
    loadAttributes: (blockId: string) => Promise<Record<string, unknown>>,
    onEditTask = vi.fn(),
    options: {
        repairMarkdown?: (blockId: string, markdown: string) => Promise<void>;
        getEditors?: () => Protyle[];
    } = {},
): {
    eventBus: TestEventBus;
    lifecycle: TaskCardLifecycle;
} {
    const eventBus = new TestEventBus();
    const lifecycle = new TaskCardLifecycle(eventBus as unknown as EventBus, {
        translate: (key) => ({
            "taskCardView.status": "Status",
            "status.inProgress": "In progress",
            "status.completed": "Completed",
            "taskEdit.statusButtonTitle": "Click to edit task",
            "taskEdit.statusButtonAriaLabel": "Edit task, current status: ${status}",
        })[key] ?? key,
        loadAttributes,
        repairMarkdown: options.repairMarkdown,
        getEditors: options.getEditors,
        actions: { onEditTask },
        warn: vi.fn(),
    });
    activeLifecycles.push(lifecycle);
    return { eventBus, lifecycle };
}

function createRegisteredLifecycle(
    root: HTMLElement,
    loadAttributes: (blockId: string) => Promise<Record<string, unknown>>,
    onEditTask = vi.fn(),
): TaskCardLifecycle {
    const { lifecycle } = createLifecycleHarness(loadAttributes, onEditTask);
    lifecycle.start();
    lifecycle.refresh(asProtyle(root));
    return lifecycle;
}

function observerCount(lifecycle: TaskCardLifecycle): number {
    return (lifecycle as unknown as { observers: Map<HTMLElement, unknown> }).observers.size;
}

function contentStateCount(lifecycle: TaskCardLifecycle): number {
    return (lifecycle as unknown as { contentStates: Map<HTMLElement, unknown> }).contentStates.size;
}

async function settleMutations(): Promise<void> {
    await Promise.resolve();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
}

describe("TaskCardLifecycle startup discovery", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    afterEach(() => {
        for (const lifecycle of activeLifecycles.splice(0)) {
            lifecycle.stop();
        }
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("enhances and observes a Protyle that already exists when start is called", async () => {
        const block = createBlock();
        const root = createProtyleRoot(block);
        mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { lifecycle } = createLifecycleHarness(loadAttributes);

        lifecycle.start();
        await settleMutations();

        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(observerCount(lifecycle)).toBe(1);
        expect(loadAttributes).toHaveBeenCalledOnce();
    });

    it("finds a Protyle inserted during the bounded startup compensation window", async () => {
        vi.useFakeTimers();
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { lifecycle } = createLifecycleHarness(loadAttributes);
        lifecycle.start();

        const block = createBlock();
        const root = createProtyleRoot(block);
        mountProtyle(root);
        await vi.advanceTimersByTimeAsync(300);

        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(observerCount(lifecycle)).toBe(1);
        const callsAfterDiscovery = loadAttributes.mock.calls.length;

        await vi.advanceTimersByTimeAsync(5_000);
        expect(loadAttributes).toHaveBeenCalledTimes(callsAfterDiscovery);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("keeps initial discovery and a later loaded event idempotent", async () => {
        const block = createBlock();
        const root = createProtyleRoot(block);
        mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { eventBus, lifecycle } = createLifecycleHarness(loadAttributes);
        lifecycle.start();
        await settleMutations();

        eventBus.emit("loaded-protyle-static", asProtyle(root));
        await settleMutations();

        expect(observerCount(lifecycle)).toBe(1);
        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(getTaskCardDecoration(block)?.querySelectorAll(".ticktick-task-card__status"))
            .toHaveLength(1);
        expect(loadAttributes).toHaveBeenCalledOnce();
    });

    it("keeps getAllEditor, DOM, animation-frame, timer, and event discovery idempotent", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
            window.setTimeout(() => callback(16), 16));
        vi.stubGlobal("cancelAnimationFrame", (handle: number) => window.clearTimeout(handle));
        const block = createBlock();
        const root = createProtyleRoot(block);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const getEditors = vi.fn(() => [{ protyle: asProtyle(root) }] as Protyle[]);
        const { eventBus, lifecycle } = createLifecycleHarness(
            loadAttributes,
            vi.fn(),
            { getEditors },
        );

        lifecycle.start();
        await vi.advanceTimersByTimeAsync(16);
        mountProtyle(root);
        await vi.advanceTimersByTimeAsync(200);
        eventBus.emit("loaded-protyle-static", asProtyle(root));
        eventBus.emit("switch-protyle", asProtyle(root));
        await vi.advanceTimersByTimeAsync(0);

        expect(getEditors.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(observerCount(lifecycle)).toBe(1);
        expect(document.body.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
        expect(getTaskCardDecoration(block)).not.toBeNull();
    });

    it("ignores the MutationObserver record created by its own decoration", async () => {
        const block = createBlock();
        const root = createProtyleRoot(block);
        mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const repairMarkdown = vi.fn(async () => undefined);
        const { lifecycle } = createLifecycleHarness(
            loadAttributes,
            vi.fn(),
            { repairMarkdown },
        );

        lifecycle.start();
        await settleMutations();

        expect(loadAttributes).toHaveBeenCalledOnce();
        expect(repairMarkdown).not.toHaveBeenCalled();
        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(document.body.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("recovers when the loaded event happened before start", async () => {
        const block = createBlock();
        const root = createProtyleRoot(block);
        mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { eventBus, lifecycle } = createLifecycleHarness(loadAttributes);

        eventBus.emit("loaded-protyle-static", asProtyle(root));
        lifecycle.start();
        await settleMutations();

        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(observerCount(lifecycle)).toBe(1);
    });

    it("does not duplicate DOM or click listeners across every refresh path", async () => {
        const block = createBlock();
        const root = createProtyleRoot(block);
        mountProtyle(root);
        const onEditTask = vi.fn();
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { eventBus, lifecycle } = createLifecycleHarness(loadAttributes, onEditTask);
        lifecycle.start();
        await settleMutations();

        lifecycle.refresh(asProtyle(root));
        await lifecycle.refreshBlockById(FIRST_ID);
        eventBus.emit("switch-protyle", asProtyle(root));
        block.setAttribute(TASK_BLOCK_ATTRIBUTES.status, "in-progress");
        await settleMutations();

        expect(observerCount(lifecycle)).toBe(1);
        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(getTaskCardDecoration(block)?.querySelectorAll(".ticktick-task-card__status"))
            .toHaveLength(1);

        getTaskCardDecoration(block)
            ?.querySelector<HTMLButtonElement>(".ticktick-task-card__status")?.click();
        expect(onEditTask).toHaveBeenCalledOnce();
    });

    it("enhances fallback Markdown from the seven persisted task attributes", async () => {
        const block = createBlock();
        const original = block.firstElementChild as HTMLElement;
        const root = createProtyleRoot(block);
        mountProtyle(root);
        const { lifecycle } = createLifecycleHarness(async () => VALID_ATTRIBUTES);

        lifecycle.start();
        await settleMutations();

        expect(original.textContent).toBe("TickTick task: DS9 Adaptor");
        expect(original.getAttribute("class")).toBeNull();
        expect(getTaskCardDecoration(block)).not.toBeNull();
    });

    it("ignores ordinary blocks and marker=false blocks", async () => {
        const ordinary = createBlock(FIRST_ID, null);
        const disabled = createBlock(SECOND_ID, "false");
        const ordinaryMarkdown = ordinary.textContent;
        const disabledMarkdown = disabled.textContent;
        const root = createProtyleRoot(ordinary, disabled);
        mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { lifecycle } = createLifecycleHarness(loadAttributes);

        lifecycle.start();
        await settleMutations();

        expect(loadAttributes).not.toHaveBeenCalled();
        expect(ordinary.textContent).toBe(ordinaryMarkdown);
        expect(disabled.textContent).toBe(disabledMarkdown);
        expect(root.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
    });

    it("cancels startup compensation, observers, and listeners on stop", async () => {
        vi.useFakeTimers();
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { eventBus, lifecycle } = createLifecycleHarness(loadAttributes);
        lifecycle.start();
        lifecycle.stop();

        const block = createBlock();
        const root = createProtyleRoot(block);
        mountProtyle(root);
        eventBus.emit("loaded-protyle-static", asProtyle(root));
        await vi.advanceTimersByTimeAsync(500);

        expect(loadAttributes).not.toHaveBeenCalled();
        expect(observerCount(lifecycle)).toBe(0);
        expect(getTaskCardDecoration(block)).toBeNull();
        expect(eventBus.off).toHaveBeenCalledTimes(5);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("removes an enhanced card on stop without changing persisted block content", async () => {
        const block = createBlock();
        const persistedDom = block.outerHTML;
        const root = createProtyleRoot(block);
        mountProtyle(root);
        const { lifecycle } = createLifecycleHarness(async () => VALID_ATTRIBUTES);

        lifecycle.start();
        await settleMutations();
        expect(getTaskCardDecoration(block)).not.toBeNull();

        lifecycle.stop();

        expect(getTaskCardDecoration(block)).toBeNull();
        expect(block.outerHTML).toBe(persistedDom);
        expect(observerCount(lifecycle)).toBe(0);
    });

    it("registers multiple Protyles once and destroys only the requested one", async () => {
        const firstBlock = createBlock(FIRST_ID);
        const secondBlock = createBlock(SECOND_ID);
        const firstRoot = createProtyleRoot(firstBlock);
        const secondRoot = createProtyleRoot(secondBlock);
        mountProtyle(firstRoot);
        mountProtyle(secondRoot);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { eventBus, lifecycle } = createLifecycleHarness(loadAttributes);

        lifecycle.start();
        await settleMutations();
        eventBus.emit("loaded-protyle-dynamic", asProtyle(firstRoot));
        eventBus.emit("loaded-protyle-static", asProtyle(secondRoot));
        await settleMutations();

        expect(observerCount(lifecycle)).toBe(2);
        expect(getTaskCardDecoration(firstBlock)).not.toBeNull();
        expect(getTaskCardDecoration(secondBlock)).not.toBeNull();

        eventBus.emit("destroy-protyle", asProtyle(firstRoot));
        expect(observerCount(lifecycle)).toBe(1);
        expect(getTaskCardDecoration(firstBlock)).toBeNull();
        expect(getTaskCardDecoration(secondBlock)).not.toBeNull();
    });
});

describe("TaskCardLifecycle readonly content roots", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    afterEach(() => {
        for (const lifecycle of activeLifecycles.splice(0)) {
            lifecycle.stop();
        }
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("enhances the readonly root that already exists at startup", async () => {
        const block = createBlock(FIRST_ID, "true", true);
        const root = createProtyleRoot(block);
        root.setAttribute("contenteditable", "false");
        root.setAttribute("data-readonly", "true");
        const { protyle } = mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { lifecycle } = createLifecycleHarness(loadAttributes, vi.fn(), {
            getEditors: () => [{ protyle }] as Protyle[],
        });

        lifecycle.start();
        await settleMutations();

        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(loadAttributes).toHaveBeenCalledOnce();
    });

    it("removes and restores a readonly decoration across plugin disable and enable", async () => {
        const block = createBlock(FIRST_ID, "true", true);
        const root = createProtyleRoot(block);
        root.setAttribute("contenteditable", "false");
        root.setAttribute("data-readonly", "true");
        const { protyle } = mountProtyle(root);
        const options = { getEditors: () => [{ protyle }] as Protyle[] };
        const first = createLifecycleHarness(async () => VALID_ATTRIBUTES, vi.fn(), options).lifecycle;
        first.start();
        await settleMutations();
        expect(getTaskCardDecoration(block)).not.toBeNull();

        first.stop();
        expect(getTaskCardDecoration(block)).toBeNull();

        const second = createLifecycleHarness(async () => VALID_ATTRIBUTES, vi.fn(), options).lifecycle;
        second.start();
        await settleMutations();
        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(root.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it.each([
        ["readonly to editable", true, false],
        ["editable to readonly", false, true],
    ])("enhances a replacement root for %s", async (_label, startsReadonly, endsReadonly) => {
        const firstBlock = createBlock(FIRST_ID, "true", startsReadonly);
        const firstRoot = createProtyleRoot(firstBlock);
        firstRoot.setAttribute("contenteditable", startsReadonly ? "false" : "true");
        firstRoot.setAttribute("data-readonly", startsReadonly ? "true" : "false");
        const { content, protyle } = mountProtyle(firstRoot);
        const { lifecycle } = createLifecycleHarness(async () => VALID_ATTRIBUTES, vi.fn(), {
            getEditors: () => [{ protyle }] as Protyle[],
        });
        lifecycle.start();
        await settleMutations();
        expect(getTaskCardDecoration(firstBlock)).not.toBeNull();

        const secondBlock = createBlock(FIRST_ID, "true", endsReadonly);
        const secondRoot = createProtyleRoot(secondBlock);
        secondRoot.setAttribute("contenteditable", endsReadonly ? "false" : "true");
        secondRoot.setAttribute("data-readonly", endsReadonly ? "true" : "false");
        content.replaceChildren(secondRoot);
        protyle.wysiwyg!.element = secondRoot;
        protyle.disabled = endsReadonly;
        await settleMutations();

        expect(firstRoot.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect(getTaskCardDecoration(secondBlock)).not.toBeNull();
    });

    it("handles the real loaded-protyle-static readonly payload", async () => {
        const block = createBlock(FIRST_ID, "true", true);
        const root = createProtyleRoot(block);
        root.setAttribute("contenteditable", "false");
        root.setAttribute("data-readonly", "true");
        const { protyle } = mountProtyle(root);
        const { eventBus, lifecycle } = createLifecycleHarness(async () => VALID_ATTRIBUTES);
        lifecycle.start();

        eventBus.emit("loaded-protyle-static", protyle);
        await settleMutations();

        expect(getTaskCardDecoration(block)).not.toBeNull();
    });

    it("renders both DOM instances while sharing one concurrent block data load", async () => {
        const firstBlock = createBlock(FIRST_ID, "true", true);
        const secondBlock = createBlock(FIRST_ID, "true", false);
        const first = mountProtyle(createProtyleRoot(firstBlock));
        const second = mountProtyle(createProtyleRoot(secondBlock));
        let resolveAttributes!: (attributes: Record<string, unknown>) => void;
        const attributes = new Promise<Record<string, unknown>>((resolve) => {
            resolveAttributes = resolve;
        });
        const loadAttributes = vi.fn(() => attributes);
        const { lifecycle } = createLifecycleHarness(loadAttributes, vi.fn(), {
            getEditors: () => [{ protyle: first.protyle }, { protyle: second.protyle }] as Protyle[],
        });

        lifecycle.start();
        await Promise.resolve();
        expect(loadAttributes).toHaveBeenCalledOnce();
        resolveAttributes(VALID_ATTRIBUTES);
        await settleMutations();

        expect(loadAttributes).toHaveBeenCalledOnce();
        expect(getTaskCardDecoration(firstBlock)).not.toBeNull();
        expect(getTaskCardDecoration(secondBlock)).not.toBeNull();
    });

    it("enhances a healthy readonly fallback without repairing it", async () => {
        const block = createBlock(FIRST_ID, "true", true);
        const root = createProtyleRoot(block);
        root.setAttribute("data-readonly", "true");
        const { protyle } = mountProtyle(root);
        const repairMarkdown = vi.fn(async () => undefined);
        const { lifecycle } = createLifecycleHarness(async () => VALID_ATTRIBUTES, vi.fn(), {
            getEditors: () => [{ protyle }] as Protyle[],
            repairMarkdown,
        });

        lifecycle.start();
        await settleMutations();

        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(repairMarkdown).not.toHaveBeenCalled();
    });

    it("ignores the readonly root mutation created by its own sibling decoration", async () => {
        const block = createBlock(FIRST_ID, "true", true);
        const root = createProtyleRoot(block);
        root.setAttribute("data-readonly", "true");
        const { protyle } = mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const repairMarkdown = vi.fn(async () => undefined);
        const { lifecycle } = createLifecycleHarness(loadAttributes, vi.fn(), {
            getEditors: () => [{ protyle }] as Protyle[],
            repairMarkdown,
        });

        lifecycle.start();
        await settleMutations();

        expect(loadAttributes).toHaveBeenCalledOnce();
        expect(repairMarkdown).not.toHaveBeenCalled();
        expect(root.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(1);
    });

    it("enhances readonly and editable documents together without duplicate cards", async () => {
        const readonlyBlock = createBlock(FIRST_ID, "true", true);
        const editableBlock = createBlock(SECOND_ID, "true", false);
        const readonly = mountProtyle(createProtyleRoot(readonlyBlock));
        const editable = mountProtyle(createProtyleRoot(editableBlock));
        const { lifecycle } = createLifecycleHarness(async () => VALID_ATTRIBUTES, vi.fn(), {
            getEditors: () => [{ protyle: readonly.protyle }, { protyle: editable.protyle }] as Protyle[],
        });

        lifecycle.start();
        await settleMutations();

        expect(getTaskCardDecoration(readonlyBlock)).not.toBeNull();
        expect(getTaskCardDecoration(editableBlock)).not.toBeNull();
        expect(document.querySelectorAll(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toHaveLength(2);
    });

    it("removes an external decoration when its readonly block is removed", async () => {
        const block = createBlock(FIRST_ID, "true", true);
        const root = createProtyleRoot(block);
        root.setAttribute("data-readonly", "true");
        const { protyle } = mountProtyle(root);
        const { lifecycle } = createLifecycleHarness(async () => VALID_ATTRIBUTES, vi.fn(), {
            getEditors: () => [{ protyle }] as Protyle[],
        });

        lifecycle.start();
        await settleMutations();
        expect(getTaskCardDecoration(block)).not.toBeNull();

        block.remove();
        await settleMutations();

        expect(root.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
    });

    it("does not discover Protyle-shaped roots inside dialogs or the task center", async () => {
        const dialog = document.createElement("div");
        dialog.className = "b3-dialog";
        const dialogBlock = createBlock(FIRST_ID);
        const dialogContent = document.createElement("div");
        dialogContent.className = "protyle-content";
        dialogContent.append(createProtyleRoot(dialogBlock));
        dialog.append(dialogContent);

        const taskCenter = document.createElement("div");
        taskCenter.className = "ticktick-task-center";
        const taskCenterBlock = createBlock(SECOND_ID);
        const taskCenterContent = document.createElement("div");
        taskCenterContent.className = "protyle-content";
        taskCenterContent.append(createProtyleRoot(taskCenterBlock));
        taskCenter.append(taskCenterContent);
        document.body.append(dialog, taskCenter);

        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const { lifecycle } = createLifecycleHarness(loadAttributes);
        lifecycle.start();
        await settleMutations();

        expect(loadAttributes).not.toHaveBeenCalled();
        expect(getTaskCardDecoration(dialogBlock)).toBeNull();
        expect(getTaskCardDecoration(taskCenterBlock)).toBeNull();
    });

    it("cleans editable and readonly roots and their container observers on stop", async () => {
        const readonlyBlock = createBlock(FIRST_ID, "true", true);
        const editableBlock = createBlock(SECOND_ID, "true", false);
        const readonly = mountProtyle(createProtyleRoot(readonlyBlock));
        const editable = mountProtyle(createProtyleRoot(editableBlock));
        const { eventBus, lifecycle } = createLifecycleHarness(async () => VALID_ATTRIBUTES, vi.fn(), {
            getEditors: () => [{ protyle: readonly.protyle }, { protyle: editable.protyle }] as Protyle[],
        });
        lifecycle.start();
        await settleMutations();
        expect(observerCount(lifecycle)).toBe(2);
        expect(contentStateCount(lifecycle)).toBe(2);

        lifecycle.stop();

        expect(observerCount(lifecycle)).toBe(0);
        expect(contentStateCount(lifecycle)).toBe(0);
        expect(getTaskCardDecoration(readonlyBlock)).toBeNull();
        expect(getTaskCardDecoration(editableBlock)).toBeNull();
        expect(eventBus.off).toHaveBeenCalledTimes(5);
    });
});

describe("TaskCardLifecycle attribute refresh", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    afterEach(() => {
        for (const lifecycle of activeLifecycles.splice(0)) {
            lifecycle.stop();
        }
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("refreshes status text and tone once without duplicating the card", async () => {
        const root = createProtyleRoot();
        const block = createBlock();
        root.append(block);
        mountProtyle(root);
        let attributes = { ...VALID_ATTRIBUTES };
        const loadAttributes = vi.fn(async () => attributes);
        createRegisteredLifecycle(root, loadAttributes);
        await settleMutations();

        attributes = { ...attributes, [TASK_BLOCK_ATTRIBUTES.status]: "completed" };
        block.setAttribute(TASK_BLOCK_ATTRIBUTES.status, "completed");
        await settleMutations();

        const card = getTaskCardDecoration(block);
        expect(card?.querySelector(".ticktick-task-card__status")?.textContent).toContain("Completed");
        expect(card?.getAttribute("data-status-tone")).toBe("success");
        expect(card).not.toBeNull();
    });

    it("restores Markdown when the marker is removed and enhances again when restored", async () => {
        const root = createProtyleRoot();
        const block = createBlock();
        const original = block.firstElementChild as HTMLElement;
        root.append(block);
        mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        createRegisteredLifecycle(root, loadAttributes);
        await settleMutations();
        const initialCalls = loadAttributes.mock.calls.length;

        block.setAttribute(TASK_BLOCK_ATTRIBUTES.card, "false");
        await settleMutations();
        expect(getTaskCardDecoration(block)).toBeNull();
        expect(original.getAttribute("class")).toBeNull();
        expect(loadAttributes).toHaveBeenCalledTimes(initialCalls);

        block.setAttribute(TASK_BLOCK_ATTRIBUTES.card, "true");
        await settleMutations();
        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(loadAttributes).toHaveBeenCalledTimes(initialCalls + 1);
    });

    it("rebinds the edit action when data-node-id changes on the same element", async () => {
        const root = createProtyleRoot();
        const block = createBlock();
        root.append(block);
        mountProtyle(root);
        const onEditTask = vi.fn();
        createRegisteredLifecycle(root, async () => VALID_ATTRIBUTES, onEditTask);
        await settleMutations();

        block.dataset.nodeId = SECOND_ID;
        await settleMutations();
        getTaskCardDecoration(block)
            ?.querySelector<HTMLButtonElement>(".ticktick-task-card__status")?.click();

        expect(onEditTask).toHaveBeenCalledWith(SECOND_ID, { focus: "status" });
        expect(getTaskCardDecoration(block)).not.toBeNull();
    });

    it("coalesces a synchronous seven-attribute update into one forced load", async () => {
        const root = createProtyleRoot();
        const block = createBlock();
        root.append(block);
        mountProtyle(root);
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        createRegisteredLifecycle(root, loadAttributes);
        await settleMutations();
        const initialCalls = loadAttributes.mock.calls.length;

        for (const [attribute, value] of Object.entries(VALID_ATTRIBUTES)) {
            block.setAttribute(attribute, String(value));
        }
        await settleMutations();

        expect(loadAttributes).toHaveBeenCalledTimes(initialCalls + 1);
        expect(getTaskCardDecoration(block)).not.toBeNull();
    });
});
