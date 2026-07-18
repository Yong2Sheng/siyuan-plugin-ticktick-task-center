import {
    createTaskFallbackMarkdown,
    TASK_BLOCK_ATTRIBUTES,
    type PersistedTickTickTaskData,
} from "../domain/task";
import { isSiYuanId } from "../domain/siyuan-id";
import type { Translate } from "../i18n";
import { createTaskCardViewModel } from "./card-view-model";
import {
    enhanceTaskBlock,
    isTaskBlockEnhanced,
    restoreTaskBlock,
    restoreTaskBlocks,
    TASK_CARD_BLOCK_ID_ATTRIBUTE,
    TASK_CARD_CONTAINER_ATTRIBUTE,
    type TaskCardActions,
} from "./renderer";
import { inspectTaskCardPollution } from "./persistence";
import { parseTaskBlockAttributes, type TaskBlockParseFailure } from "./task-data";

const TASK_CANDIDATE_SELECTOR = `[data-node-id][${TASK_BLOCK_ATTRIBUTES.card}="true"]`;

type TaskDataLoadResult =
    | { kind: "valid"; data: PersistedTickTickTaskData }
    | { kind: "invalid"; reason: TaskBlockParseFailure }
    | { kind: "error"; error: unknown };

type TaskDataFlight = {
    promise: Promise<TaskDataLoadResult>;
    refresh: boolean;
    queuedRefresh?: Promise<TaskDataLoadResult>;
};

export type TaskCardEnhancerOptions = {
    translate: Translate;
    loadAttributes(blockId: string): Promise<Record<string, unknown>>;
    repairMarkdown?(blockId: string, markdown: string): Promise<void>;
    actions?: TaskCardActions;
    warn?: (message: string, detail?: unknown) => void;
};

export class TaskCardEnhancer {
    private active = true;
    private readonly dataInFlightByBlockId = new Map<string, TaskDataFlight>();
    private readonly repairInFlightByBlockId = new Map<string, Promise<boolean>>();
    private readonly repairedPollutedBlockIds = new Set<string>();
    private readonly warn: (message: string, detail?: unknown) => void;

    constructor(private readonly options: TaskCardEnhancerOptions) {
        this.warn = options.warn ?? ((message, detail) => console.warn(message, detail));
    }

    async scan(root: HTMLElement): Promise<void> {
        this.cleanup(root);
        await this.scanNode(root);
    }

    async scanNode(node: Node): Promise<void> {
        if (!this.active) {
            return;
        }

        const element = node instanceof HTMLElement ? node : node.parentElement;
        if (element === null) {
            return;
        }

        if (
            element.matches("[data-node-id]")
            && !element.matches(TASK_CANDIDATE_SELECTOR)
        ) {
            restoreTaskBlock(element);
        }

        const candidates: HTMLElement[] = [];
        if (element.matches(TASK_CANDIDATE_SELECTOR)) {
            candidates.push(element);
        }
        candidates.push(...element.querySelectorAll<HTMLElement>(TASK_CANDIDATE_SELECTOR));

        await Promise.all(candidates.map((candidate) => this.enhanceCandidate(candidate)));
    }

    async enhanceKnownBlock(blockElement: HTMLElement, refresh = false): Promise<void> {
        await this.enhanceCandidate(blockElement, false, refresh);
    }

    cleanup(root: HTMLElement): void {
        this.restoreBlocksWithoutMarker(root);
    }

    restore(root: ParentNode): void {
        restoreTaskBlocks(root);
    }

    stop(): void {
        this.active = false;
        this.dataInFlightByBlockId.clear();
        this.repairInFlightByBlockId.clear();
        this.repairedPollutedBlockIds.clear();
    }

    private async enhanceCandidate(
        blockElement: HTMLElement,
        requireDomMarker = true,
        refresh = false,
    ): Promise<void> {
        if (refresh && blockElement.getAttribute(TASK_BLOCK_ATTRIBUTES.card) !== "true") {
            restoreTaskBlock(blockElement);
            return;
        }
        const initialPollution = inspectTaskCardPollution(blockElement);
        if (initialPollution.kind === "valid") {
            const initialBlockId = blockElement.dataset.nodeId;
            if (initialBlockId && this.repairedPollutedBlockIds.has(initialBlockId)) {
                return;
            }
        }
        if (!refresh && initialPollution.kind === "none" && isTaskBlockEnhanced(blockElement)) {
            return;
        }

        const blockId = blockElement.dataset.nodeId;
        if (!isSiYuanId(blockId)) {
            if (refresh) {
                restoreTaskBlock(blockElement);
            }
            this.warn(`TickTick task enhancement skipped: invalid block ID ${String(blockId)}`);
            return;
        }

        const loaded = await this.loadTaskData(blockId, refresh);
        if (loaded.kind === "error") {
            if (refresh) {
                restoreTaskBlock(blockElement);
            }
            this.warn(`TickTick task attributes could not be loaded for ${blockId}`, loaded.error);
            return;
        }
        if (loaded.kind === "invalid") {
            if (refresh) {
                restoreTaskBlock(blockElement);
            }
            this.warn(`TickTick task enhancement skipped for ${blockId}: ${loaded.reason}`);
            return;
        }
        if (blockElement.dataset.nodeId !== blockId) {
            if (refresh) {
                restoreTaskBlock(blockElement);
            }
            return;
        }
        if (
            !this.active
            || !blockElement.isConnected
            || (requireDomMarker && !blockElement.matches(TASK_CANDIDATE_SELECTOR))
            || (refresh && blockElement.getAttribute(TASK_BLOCK_ATTRIBUTES.card) !== "true")
        ) {
            return;
        }

        const pollution = inspectTaskCardPollution(blockElement);
        if (pollution.kind === "suspicious") {
            restoreTaskBlock(blockElement);
            this.warn(`TickTick task persistence repair skipped for ${blockId}: unrecognized card structure`);
            return;
        }
        if (pollution.kind === "valid") {
            restoreTaskBlock(blockElement);
            if (!this.options.repairMarkdown) {
                this.warn(`TickTick task persistence repair unavailable for ${blockId}`);
                return;
            }
            const markdown = createTaskFallbackMarkdown(
                this.options.translate("taskCard"),
                loaded.data.title,
                loaded.data.url,
            );
            await this.repairPollution(blockId, markdown);
            return;
        }

        if (refresh) {
            restoreTaskBlock(blockElement);
        }

        const enhanced = enhanceTaskBlock(
            blockElement,
            blockId,
            createTaskCardViewModel(loaded.data, this.options.translate),
            this.options.actions,
        );
        if (!enhanced) {
            this.warn(`TickTick task enhancement skipped for ${blockId}: original content not found`);
        }
    }

    private loadTaskData(blockId: string, forceFresh: boolean): Promise<TaskDataLoadResult> {
        const running = this.dataInFlightByBlockId.get(blockId);
        if (running) {
            if (!forceFresh || running.refresh) {
                return running.promise;
            }
            running.queuedRefresh ??= running.promise.then(() => this.active
                ? this.loadTaskData(blockId, true)
                : { kind: "error", error: new Error("enhancer stopped") });
            return running.queuedRefresh;
        }

        const operation = this.performTaskDataLoad(blockId);
        const flight: TaskDataFlight = { promise: operation, refresh: forceFresh };
        this.dataInFlightByBlockId.set(blockId, flight);
        void operation.finally(() => {
            if (this.dataInFlightByBlockId.get(blockId) === flight) {
                this.dataInFlightByBlockId.delete(blockId);
            }
        });
        return operation;
    }

    private async performTaskDataLoad(blockId: string): Promise<TaskDataLoadResult> {
        let attributes: Record<string, unknown>;
        try {
            attributes = await this.options.loadAttributes(blockId);
        } catch (error) {
            return { kind: "error", error };
        }

        const parsed = parseTaskBlockAttributes(attributes);
        return parsed.valid
            ? { kind: "valid", data: parsed.data }
            : { kind: "invalid", reason: parsed.reason };
    }

    private async repairPollution(blockId: string, markdown: string): Promise<boolean> {
        if (this.repairedPollutedBlockIds.has(blockId)) {
            return true;
        }
        const running = this.repairInFlightByBlockId.get(blockId);
        if (running) {
            return running;
        }

        const operation = (async (): Promise<boolean> => {
            try {
                await this.options.repairMarkdown!(blockId, markdown);
                if (this.active) {
                    this.repairedPollutedBlockIds.add(blockId);
                }
                return true;
            } catch (error) {
                this.warn(`TickTick task persistence repair failed for ${blockId}`, error);
                return false;
            }
        })();
        this.repairInFlightByBlockId.set(blockId, operation);
        try {
            return await operation;
        } finally {
            if (this.repairInFlightByBlockId.get(blockId) === operation) {
                this.repairInFlightByBlockId.delete(blockId);
            }
        }
    }

    private restoreBlocksWithoutMarker(root: HTMLElement): void {
        for (const card of root.querySelectorAll<HTMLElement>(
            `[${TASK_CARD_CONTAINER_ATTRIBUTE}][${TASK_CARD_BLOCK_ID_ATTRIBUTE}]`,
        )) {
            const block = card.nextElementSibling;
            if (
                !(block instanceof HTMLElement)
                || !block.matches(TASK_CANDIDATE_SELECTOR)
                || block.dataset.nodeId !== card.getAttribute(TASK_CARD_BLOCK_ID_ATTRIBUTE)
            ) {
                card.remove();
            }
        }
    }
}
