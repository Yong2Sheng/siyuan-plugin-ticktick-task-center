// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTaskFallbackMarkdown, TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { TaskCardEnhancer } from "./enhancer";
import { inspectTaskCardPollution } from "./persistence";
import { getTaskCardDecoration, TASK_CARD_CONTAINER_ATTRIBUTE } from "./renderer";

const BLOCK_ID = "20260718010000-abcdefg";
const VALID_ATTRIBUTES: Record<string, unknown> = {
    [TASK_BLOCK_ATTRIBUTES.card]: "true",
    [TASK_BLOCK_ATTRIBUTES.version]: "1",
    [TASK_BLOCK_ATTRIBUTES.title]: "Use the unit background for DC4 GRB analysis",
    [TASK_BLOCK_ATTRIBUTES.url]: "https://dida365.com/webapp/#p/project/tasks/task",
    [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
    [TASK_BLOCK_ATTRIBUTES.createdAt]: "2026-07-18T00:00:00.000Z",
    [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-07-18T00:00:00.000Z",
};

function createGeneratedCard(): HTMLElement {
    const card = document.createElement("div");
    card.className = "ticktick-task-card";
    card.setAttribute(TASK_CARD_CONTAINER_ATTRIBUTE, "");
    card.setAttribute("data-status-tone", "primary");
    card.setAttribute("contenteditable", "false");

    const identity = document.createElement("span");
    identity.className = "ticktick-task-card__identity";
    identity.textContent = "✅ 滴答清单任务";
    const main = document.createElement("span");
    main.className = "ticktick-task-card__main";
    const link = document.createElement("a");
    link.className = "ticktick-task-card__link";
    link.href = String(VALID_ATTRIBUTES[TASK_BLOCK_ATTRIBUTES.url]);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "打开任务";
    main.append(link);
    const status = document.createElement("button");
    status.type = "button";
    status.className = "ticktick-task-card__status";
    status.textContent = "状态: ▶️ 进行中";
    card.append(identity, main, status);
    return card;
}

function createTaskBlock(cardCount = 0, marker = "true", readonly = false): {
    block: HTMLElement;
    original: HTMLElement;
} {
    const block = document.createElement("div");
    block.dataset.nodeId = BLOCK_ID;
    for (const [attribute, value] of Object.entries(VALID_ATTRIBUTES)) {
        block.setAttribute(attribute, String(value));
    }
    block.setAttribute(TASK_BLOCK_ATTRIBUTES.card, marker);

    const original = document.createElement("div");
    original.setAttribute("contenteditable", readonly ? "false" : "true");
    original.setAttribute("spellcheck", "false");
    original.append("滴答任务：Use the unit background for DC4 GRB analysis");
    for (let index = 0; index < cardCount; index += 1) {
        original.append(createGeneratedCard());
    }
    const attr = document.createElement("div");
    attr.className = "protyle-attr";
    block.append(original, attr);
    document.body.append(block);
    return { block, original };
}

function createEnhancer(
    attributes: Record<string, unknown>,
    repairMarkdown = vi.fn(async (_blockId: string, markdown: string) => {
        const original = document.querySelector<HTMLElement>(`[data-node-id="${BLOCK_ID}"] > [contenteditable]`);
        original?.replaceChildren(markdown);
    }),
    warn = vi.fn(),
): { enhancer: TaskCardEnhancer; repairMarkdown: typeof repairMarkdown; warn: typeof warn } {
    const enhancer = new TaskCardEnhancer({
        translate: (key) => ({
            taskCard: "滴答任务",
            "taskCardView.openTask": "打开任务",
            "taskCardView.status": "状态",
            "status.inProgress": "进行中",
        })[key] ?? key,
        loadAttributes: vi.fn(async () => attributes),
        repairMarkdown,
        warn,
    });
    return { enhancer, repairMarkdown, warn };
}

describe("serialized task card pollution repair", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it("repairs one serialized plugin card to canonical Markdown", async () => {
        const { block, original } = createTaskBlock(1);
        const attributesBeforeRepair = Object.fromEntries(
            Object.values(TASK_BLOCK_ATTRIBUTES).map((attribute) => [
                attribute,
                block.getAttribute(attribute),
            ]),
        );
        const { enhancer, repairMarkdown } = createEnhancer(VALID_ATTRIBUTES);

        expect(inspectTaskCardPollution(block)).toEqual({ kind: "valid", cardCount: 1 });
        await enhancer.scan(document.body);

        expect(repairMarkdown).toHaveBeenCalledWith(
            BLOCK_ID,
            "滴答任务：[Use the unit background for DC4 GRB analysis](https://dida365.com/webapp/#p/project/tasks/task)",
        );
        expect(original.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect(original.textContent).toBe(
            "滴答任务：[Use the unit background for DC4 GRB analysis](https://dida365.com/webapp/#p/project/tasks/task)",
        );
        expect(Object.fromEntries(
            Object.values(TASK_BLOCK_ATTRIBUTES).map((attribute) => [
                attribute,
                block.getAttribute(attribute),
            ]),
        )).toEqual(attributesBeforeRepair);
    });

    it("repairs two serialized plugin cards and re-enhances with one external card", async () => {
        const { block, original } = createTaskBlock(2);
        const { enhancer, repairMarkdown } = createEnhancer(VALID_ATTRIBUTES);

        expect(inspectTaskCardPollution(block)).toEqual({ kind: "valid", cardCount: 2 });
        await enhancer.scan(document.body);
        await enhancer.scan(document.body);

        expect(repairMarkdown).toHaveBeenCalledOnce();
        expect(original.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(document.body.querySelectorAll(`[data-ticktick-task-block-id="${BLOCK_ID}"]`))
            .toHaveLength(1);
    });

    it.each([1, 2])("repairs %i serialized card copies in a readonly block", async (cardCount) => {
        const { block, original } = createTaskBlock(cardCount, "true", true);
        const { enhancer, repairMarkdown } = createEnhancer(VALID_ATTRIBUTES);

        await enhancer.scan(document.body);
        await enhancer.scan(document.body);

        expect(repairMarkdown).toHaveBeenCalledOnce();
        expect(original.querySelector(`[${TASK_CARD_CONTAINER_ATTRIBUTE}]`)).toBeNull();
        expect(getTaskCardDecoration(block)).not.toBeNull();
        expect(original.getAttribute("contenteditable")).toBe("false");
    });

    it("repairs one block ID once while preserving both readonly DOM decorations", async () => {
        const first = createTaskBlock(1, "true", true);
        const second = createTaskBlock(1, "true", true);
        let resolveAttributes!: (attributes: Record<string, unknown>) => void;
        const attributes = new Promise<Record<string, unknown>>((resolve) => {
            resolveAttributes = resolve;
        });
        const loadAttributes = vi.fn(() => attributes);
        const repairMarkdown = vi.fn(async (_blockId: string, markdown: string) => {
            for (const original of document.querySelectorAll<HTMLElement>(
                `[data-node-id="${BLOCK_ID}"] > [contenteditable]`,
            )) {
                original.replaceChildren(markdown);
            }
        });
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key === "taskCard" ? "滴答任务" : key,
            loadAttributes,
            repairMarkdown,
        });

        const scan = enhancer.scan(document.body);
        await Promise.resolve();
        expect(loadAttributes).toHaveBeenCalledOnce();
        resolveAttributes(VALID_ATTRIBUTES);
        await scan;
        await enhancer.scan(document.body);

        expect(repairMarkdown).toHaveBeenCalledOnce();
        expect(getTaskCardDecoration(first.block)).not.toBeNull();
        expect(getTaskCardDecoration(second.block)).not.toBeNull();
        expect(document.querySelectorAll(`[data-ticktick-task-block-id="${BLOCK_ID}"]`))
            .toHaveLength(2);
    });

    it("is idempotent after repair and never rewrites a healthy block", async () => {
        const { block } = createTaskBlock(1);
        const { enhancer, repairMarkdown } = createEnhancer(VALID_ATTRIBUTES);
        await enhancer.scan(document.body);
        const healthyPersistedDom = block.outerHTML;

        await enhancer.scan(document.body);
        await enhancer.scan(document.body);

        expect(repairMarkdown).toHaveBeenCalledOnce();
        expect(block.outerHTML).toBe(healthyPersistedDom);
    });

    it("does not submit duplicate repairs while the repaired DOM is still stale", async () => {
        const { block } = createTaskBlock(1);
        let resolveAttributes!: (attributes: Record<string, unknown>) => void;
        const attributes = new Promise<Record<string, unknown>>((resolve) => {
            resolveAttributes = resolve;
        });
        const repairMarkdown = vi.fn(async () => undefined);
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key === "taskCard" ? "滴答任务" : key,
            loadAttributes: vi.fn(() => attributes),
            repairMarkdown,
        });

        const first = enhancer.enhanceKnownBlock(block);
        const second = enhancer.enhanceKnownBlock(block);
        resolveAttributes(VALID_ATTRIBUTES);
        await Promise.all([first, second]);

        expect(repairMarkdown).toHaveBeenCalledOnce();
        expect(inspectTaskCardPollution(block)).toEqual({ kind: "valid", cardCount: 1 });
    });

    it("does not repair ordinary user HTML", async () => {
        const { block, original } = createTaskBlock();
        const userHtml = document.createElement("div");
        userHtml.append(document.createElement("span"), document.createElement("button"));
        original.append(userHtml);
        const persistedDom = block.outerHTML;
        const { enhancer, repairMarkdown } = createEnhancer(VALID_ATTRIBUTES);

        await enhancer.scan(document.body);

        expect(repairMarkdown).not.toHaveBeenCalled();
        expect(block.outerHTML).toBe(persistedDom);
        expect(getTaskCardDecoration(block)).not.toBeNull();
    });

    it("does not repair an unrecognized element that only resembles a plugin card", async () => {
        const { block, original } = createTaskBlock(0, "true", true);
        const suspicious = document.createElement("div");
        suspicious.className = "ticktick-task-card";
        suspicious.textContent = "user content";
        original.append(suspicious);
        const { enhancer, repairMarkdown, warn } = createEnhancer(VALID_ATTRIBUTES);

        await enhancer.scan(document.body);

        expect(inspectTaskCardPollution(block)).toEqual({ kind: "suspicious" });
        expect(repairMarkdown).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(
            `TickTick task persistence repair skipped for ${BLOCK_ID}: unrecognized card structure`,
        );
    });

    it("does not overwrite pollution when persisted attributes are incomplete", async () => {
        createTaskBlock(1);
        const incomplete = { ...VALID_ATTRIBUTES };
        delete incomplete[TASK_BLOCK_ATTRIBUTES.title];
        const { enhancer, repairMarkdown, warn } = createEnhancer(incomplete);

        await enhancer.scan(document.body);

        expect(repairMarkdown).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(
            `TickTick task enhancement skipped for ${BLOCK_ID}: missing-title`,
        );
    });

    it("does not load or repair marker=false blocks", async () => {
        createTaskBlock(1, "false");
        const repairMarkdown = vi.fn();
        const loadAttributes = vi.fn(async () => VALID_ATTRIBUTES);
        const enhancer = new TaskCardEnhancer({
            translate: (key) => key,
            loadAttributes,
            repairMarkdown,
        });

        await enhancer.scan(document.body);

        expect(loadAttributes).not.toHaveBeenCalled();
        expect(repairMarkdown).not.toHaveBeenCalled();
    });

    it("preserves special title characters through the canonical formatter", async () => {
        createTaskBlock(1);
        const title = `A & B <C> "quoted" (round) 中文 🚀`;
        const attributes = { ...VALID_ATTRIBUTES, [TASK_BLOCK_ATTRIBUTES.title]: title };
        const repairMarkdown = vi.fn(async () => undefined);
        const { enhancer } = createEnhancer(attributes, repairMarkdown);

        await enhancer.scan(document.body);

        expect(repairMarkdown).toHaveBeenCalledWith(
            BLOCK_ID,
            createTaskFallbackMarkdown(
                "滴答任务",
                title,
                String(VALID_ATTRIBUTES[TASK_BLOCK_ATTRIBUTES.url]),
            ),
        );
    });

    it.each([
        "https://dida365.com/webapp/#p/project/tasks/task",
        "https://ticktick.com/webapp/#p/project/tasks/task",
    ])("preserves the complete URL fragment when repairing %s", async (url) => {
        createTaskBlock(1);
        const attributes = { ...VALID_ATTRIBUTES, [TASK_BLOCK_ATTRIBUTES.url]: url };
        const repairMarkdown = vi.fn(async () => undefined);
        const { enhancer } = createEnhancer(attributes, repairMarkdown);

        await enhancer.scan(document.body);

        expect(repairMarkdown).toHaveBeenCalledWith(
            BLOCK_ID,
            createTaskFallbackMarkdown(
                "滴答任务",
                String(VALID_ATTRIBUTES[TASK_BLOCK_ATTRIBUTES.title]),
                url,
            ),
        );
    });
});
