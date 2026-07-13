import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { isSiYuanId } from "../domain/siyuan-id";
import type { Translate } from "../i18n";
import { createTaskCardViewModel } from "./card-view-model";
import {
    enhanceTaskBlock,
    ENHANCED_BLOCK_CLASS,
    isTaskBlockEnhanced,
    restoreTaskBlock,
    restoreTaskBlocks,
    type TaskCardActions,
} from "./renderer";
import { parseTaskBlockAttributes } from "./task-data";

const TASK_CANDIDATE_SELECTOR = `[data-node-id][${TASK_BLOCK_ATTRIBUTES.card}="true"]`;

export type TaskCardEnhancerOptions = {
    translate: Translate;
    loadAttributes(blockId: string): Promise<Record<string, unknown>>;
    actions?: TaskCardActions;
    warn?: (message: string, detail?: unknown) => void;
};

export class TaskCardEnhancer {
    private active = true;
    private readonly pending = new WeakSet<HTMLElement>();
    private readonly queuedRefresh = new WeakSet<HTMLElement>();
    private readonly warn: (message: string, detail?: unknown) => void;

    constructor(private readonly options: TaskCardEnhancerOptions) {
        this.warn = options.warn ?? ((message, detail) => console.warn(message, detail));
    }

    async scan(root: HTMLElement): Promise<void> {
        this.restoreBlocksWithoutMarker(root);
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

        if (element.classList.contains(ENHANCED_BLOCK_CLASS) && !element.matches(TASK_CANDIDATE_SELECTOR)) {
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

    restore(root: ParentNode): void {
        restoreTaskBlocks(root);
    }

    stop(): void {
        this.active = false;
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
        if (!refresh && isTaskBlockEnhanced(blockElement)) {
            return;
        }
        if (this.pending.has(blockElement)) {
            if (refresh) {
                this.queuedRefresh.add(blockElement);
            }
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

        this.pending.add(blockElement);
        try {
            const attributes = await this.options.loadAttributes(blockId);
            const parsed = parseTaskBlockAttributes(attributes);
            if (!parsed.valid) {
                if (refresh) {
                    restoreTaskBlock(blockElement);
                }
                this.warn(`TickTick task enhancement skipped for ${blockId}: ${parsed.reason}`);
                return;
            }
            if (blockElement.dataset.nodeId !== blockId) {
                if (refresh) {
                    restoreTaskBlock(blockElement);
                }
                this.queuedRefresh.add(blockElement);
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
            if (this.queuedRefresh.has(blockElement)) {
                return;
            }

            if (refresh) {
                restoreTaskBlock(blockElement);
            }

            const enhanced = enhanceTaskBlock(
                blockElement,
                blockId,
                createTaskCardViewModel(parsed.data, this.options.translate),
                this.options.actions,
            );
            if (!enhanced) {
                this.warn(`TickTick task enhancement skipped for ${blockId}: original content not found`);
            }
        } catch (error) {
            if (refresh) {
                restoreTaskBlock(blockElement);
            }
            this.warn(`TickTick task attributes could not be loaded for ${blockId}`, error);
        } finally {
            this.pending.delete(blockElement);
            if (
                this.queuedRefresh.delete(blockElement)
                && this.active
                && blockElement.isConnected
            ) {
                await this.enhanceCandidate(blockElement, false, true);
            }
        }
    }

    private restoreBlocksWithoutMarker(root: HTMLElement): void {
        for (const block of root.querySelectorAll<HTMLElement>(`.${ENHANCED_BLOCK_CLASS}`)) {
            if (!block.matches(TASK_CANDIDATE_SELECTOR)) {
                restoreTaskBlock(block);
            }
        }
    }
}
