import {
    getAllEditor,
    type EventBus,
    type IProtyle,
} from "siyuan";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { TaskCardEnhancer, type TaskCardEnhancerOptions } from "./enhancer";
import { restoreTaskBlock } from "./renderer";

type ObserverState = {
    root: HTMLElement;
    observer: MutationObserver;
    pendingNodes: Set<Node>;
    forcedBlocks: Set<HTMLElement>;
    scheduled: boolean;
};

export class TaskCardLifecycle {
    private readonly enhancer: TaskCardEnhancer;
    private readonly observers = new Map<HTMLElement, ObserverState>();
    private readonly refreshTimers = new Set<number>();
    private started = false;

    constructor(
        private readonly eventBus: EventBus,
        options: TaskCardEnhancerOptions,
    ) {
        this.enhancer = new TaskCardEnhancer(options);
    }

    start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        this.eventBus.on("loaded-protyle-static", this.onProtyleReady);
        this.eventBus.on("loaded-protyle-dynamic", this.onProtyleReady);
        this.eventBus.on("switch-protyle", this.onProtyleReady);
        this.eventBus.on("destroy-protyle", this.onProtyleDestroyed);

        for (const editor of getAllEditor()) {
            this.register(editor.protyle);
        }
    }

    refresh(protyle: IProtyle): void {
        this.register(protyle);
        const root = protyle.wysiwyg?.element;
        if (root) {
            void this.enhancer.scan(root);
        }
    }

    refreshBlock(protyle: IProtyle, blockId: string): void {
        this.register(protyle);
        const root = protyle.wysiwyg?.element;
        if (!root) {
            return;
        }

        const enhance = (): boolean => {
            const block = root.querySelector<HTMLElement>(`[data-node-id="${blockId}"]`);
            if (!block) {
                return false;
            }
            void this.enhancer.enhanceKnownBlock(block);
            return true;
        };

        if (!enhance()) {
            const timer = window.setTimeout(() => {
                this.refreshTimers.delete(timer);
                enhance();
            }, 120);
            this.refreshTimers.add(timer);
        }
    }

    async refreshBlockById(blockId: string): Promise<boolean> {
        let blocks = this.findOpenBlocks(blockId);
        if (blocks.size === 0) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
            blocks = this.findOpenBlocks(blockId);
        }

        await Promise.all(Array.from(blocks, (block) => this.enhancer.enhanceKnownBlock(block, true)));
        return blocks.size > 0;
    }

    stop(): void {
        if (!this.started) {
            return;
        }
        this.eventBus.off("loaded-protyle-static", this.onProtyleReady);
        this.eventBus.off("loaded-protyle-dynamic", this.onProtyleReady);
        this.eventBus.off("switch-protyle", this.onProtyleReady);
        this.eventBus.off("destroy-protyle", this.onProtyleDestroyed);

        this.enhancer.stop();
        for (const timer of this.refreshTimers) {
            window.clearTimeout(timer);
        }
        this.refreshTimers.clear();
        for (const state of this.observers.values()) {
            state.observer.disconnect();
            this.enhancer.restore(state.root);
        }
        this.observers.clear();
        this.started = false;
    }

    private readonly onProtyleReady = ({ detail }: CustomEvent<{ protyle: IProtyle }>): void => {
        this.refresh(detail.protyle);
    };

    private readonly onProtyleDestroyed = ({ detail }: CustomEvent<{ protyle: IProtyle }>): void => {
        const root = detail.protyle.wysiwyg?.element;
        if (root) {
            this.unregister(root);
        }
    };

    private register(protyle: IProtyle): void {
        const root = protyle.wysiwyg?.element;
        if (!root || this.observers.has(root)) {
            return;
        }

        const state = {} as ObserverState;
        state.root = root;
        state.pendingNodes = new Set<Node>();
        state.forcedBlocks = new Set<HTMLElement>();
        state.scheduled = false;
        state.observer = new MutationObserver((mutations) => this.handleMutations(state, mutations));
        state.observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [...Object.values(TASK_BLOCK_ATTRIBUTES), "data-node-id"],
        });
        this.observers.set(root, state);
        void this.enhancer.scan(root);
    }

    private unregister(root: HTMLElement): void {
        const state = this.observers.get(root);
        if (!state) {
            return;
        }
        state.observer.disconnect();
        this.enhancer.restore(root);
        this.observers.delete(root);
    }

    private findOpenBlocks(blockId: string): Set<HTMLElement> {
        const blocks = new Set<HTMLElement>();
        for (const { root } of this.observers.values()) {
            const block = root.querySelector<HTMLElement>(`[data-node-id="${blockId}"]`);
            if (block) {
                blocks.add(block);
            }
        }
        return blocks;
    }

    private handleMutations(state: ObserverState, mutations: MutationRecord[]): void {
        for (const mutation of mutations) {
            if (mutation.type === "attributes") {
                if (!(mutation.target instanceof HTMLElement)) {
                    continue;
                }
                if (mutation.target.getAttribute(TASK_BLOCK_ATTRIBUTES.card) !== "true") {
                    state.forcedBlocks.delete(mutation.target);
                    restoreTaskBlock(mutation.target);
                } else {
                    if (mutation.attributeName === "data-node-id") {
                        restoreTaskBlock(mutation.target);
                    }
                    state.forcedBlocks.add(mutation.target);
                }
                continue;
            }
            for (const addedNode of mutation.addedNodes) {
                state.pendingNodes.add(addedNode);
            }
        }

        if (state.pendingNodes.size === 0 && state.forcedBlocks.size === 0) {
            return;
        }
        if (state.scheduled) {
            return;
        }
        state.scheduled = true;
        queueMicrotask(() => {
            state.scheduled = false;
            const nodes = Array.from(state.pendingNodes);
            const forcedBlocks = Array.from(state.forcedBlocks);
            state.pendingNodes.clear();
            state.forcedBlocks.clear();
            for (const block of forcedBlocks) {
                if (block.isConnected) {
                    void this.enhancer.enhanceKnownBlock(block, true);
                }
            }
            for (const node of nodes) {
                void this.enhancer.scanNode(node);
            }
        });
    }
}
