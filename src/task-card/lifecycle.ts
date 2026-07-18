import {
    getAllEditor,
    type EventBus,
    type IProtyle,
} from "siyuan";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import {
    discoverMountedContentRoots,
    resolveProtyleContentRoots,
} from "./content-root";
import { TaskCardEnhancer, type TaskCardEnhancerOptions } from "./enhancer";
import { isTaskCardDecoration, restoreTaskBlock } from "./renderer";

const STARTUP_FINAL_DISCOVERY_DELAY_MS = 200;

type ObserverState = {
    root: HTMLElement;
    observer: MutationObserver;
    pendingNodes: Set<Node>;
    forcedBlocks: Set<HTMLElement>;
    cleanupRequested: boolean;
    scheduled: boolean;
};

type ContentState = {
    content: HTMLElement;
    observer: MutationObserver;
    roots: Set<HTMLElement>;
};

export type TaskCardLifecycleOptions = TaskCardEnhancerOptions & {
    getEditors?: typeof getAllEditor;
};

export class TaskCardLifecycle {
    private readonly enhancer: TaskCardEnhancer;
    private readonly observers = new Map<HTMLElement, ObserverState>();
    private readonly contentStates = new Map<HTMLElement, ContentState>();
    private readonly refreshTimers = new Set<number>();
    private startupDiscoveryFrame?: number;
    private startupDiscoveryTimer?: number;
    private started = false;
    private readonly getEditors: typeof getAllEditor;

    constructor(
        private readonly eventBus: EventBus,
        options: TaskCardLifecycleOptions,
    ) {
        this.enhancer = new TaskCardEnhancer(options);
        this.getEditors = options.getEditors ?? getAllEditor;
    }

    start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        this.eventBus.on("loaded-protyle-static", this.onProtyleReady);
        this.eventBus.on("loaded-protyle-dynamic", this.onProtyleReady);
        this.eventBus.on("switch-protyle", this.onProtyleReady);
        this.eventBus.on("switch-protyle-mode", this.onProtyleReady);
        this.eventBus.on("destroy-protyle", this.onProtyleDestroyed);

        if (!this.discoverExistingContentRoots()) {
            this.scheduleStartupDiscovery();
        }
    }

    refresh(protyle: IProtyle): void {
        const roots = this.registerProtyle(protyle);
        if (roots.length === 0) {
            this.scheduleStartupDiscovery();
            return;
        }

        this.cancelStartupDiscovery();
        for (const root of roots) {
            if (this.observers.has(root)) {
                void this.enhancer.scan(root);
            }
        }
    }

    refreshBlock(protyle: IProtyle, blockId: string): void {
        const roots = this.registerProtyle(protyle);
        const enhance = (): boolean => {
            let found = false;
            for (const root of roots.length > 0 ? roots : resolveProtyleContentRoots(protyle)) {
                const block = root.querySelector<HTMLElement>(`[data-node-id="${blockId}"]`);
                if (block) {
                    found = true;
                    void this.enhancer.enhanceKnownBlock(block);
                }
            }
            return found;
        };

        if (!enhance()) {
            const timer = window.setTimeout(() => {
                this.refreshTimers.delete(timer);
                const latestRoots = this.registerProtyle(protyle);
                for (const root of latestRoots) {
                    const block = root.querySelector<HTMLElement>(`[data-node-id="${blockId}"]`);
                    if (block) {
                        void this.enhancer.enhanceKnownBlock(block);
                    }
                }
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
        this.eventBus.off("switch-protyle-mode", this.onProtyleReady);
        this.eventBus.off("destroy-protyle", this.onProtyleDestroyed);

        this.cancelStartupDiscovery();
        this.enhancer.stop();
        for (const timer of this.refreshTimers) {
            window.clearTimeout(timer);
        }
        this.refreshTimers.clear();
        for (const state of this.contentStates.values()) {
            state.observer.disconnect();
        }
        this.contentStates.clear();
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
        const content = this.resolveContentElement(detail.protyle);
        if (content) {
            this.unregisterContent(content);
            return;
        }
        for (const root of resolveProtyleContentRoots(detail.protyle)) {
            this.unregisterContentRoot(root);
        }
    };

    private registerProtyle(protyle: IProtyle): HTMLElement[] {
        const content = this.resolveContentElement(protyle);
        if (content?.isConnected) {
            let state = this.contentStates.get(content);
            if (!state) {
                state = {
                    content,
                    roots: new Set<HTMLElement>(),
                    observer: new MutationObserver(() => {
                        if (this.started) {
                            this.syncContentRoots(state!);
                        }
                    }),
                };
                state.observer.observe(content, { childList: true });
                this.contentStates.set(content, state);
            }
            return this.syncContentRoots(state);
        }

        const roots = resolveProtyleContentRoots(protyle);
        for (const root of roots) {
            this.registerContentRoot(root);
        }
        return roots;
    }

    private resolveContentElement(protyle: IProtyle): HTMLElement | null {
        if (protyle.contentElement instanceof HTMLElement) {
            return protyle.contentElement;
        }
        const root = protyle.wysiwyg?.element;
        return root?.parentElement?.classList.contains("protyle-content")
            ? root.parentElement
            : null;
    }

    private syncContentRoots(state: ContentState): HTMLElement[] {
        const currentRoots = new Set(
            Array.from(state.content.querySelectorAll<HTMLElement>(
                ":scope > .protyle-wysiwyg",
            )).filter((root) => root.isConnected),
        );

        for (const root of state.roots) {
            if (!currentRoots.has(root)) {
                this.unregisterContentRoot(root);
            }
        }
        for (const root of currentRoots) {
            this.registerContentRoot(root);
        }
        state.roots = currentRoots;
        return Array.from(currentRoots);
    }

    private registerContentRoot(root: HTMLElement): boolean {
        if (!root.isConnected || this.observers.has(root)) {
            return false;
        }

        const state = {} as ObserverState;
        state.root = root;
        state.pendingNodes = new Set<Node>();
        state.forcedBlocks = new Set<HTMLElement>();
        state.cleanupRequested = false;
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
        return true;
    }

    private discoverExistingContentRoots(): boolean {
        this.removeDisconnectedRoots();
        for (const editor of this.getEditors()) {
            this.registerProtyle(editor.protyle);
        }
        for (const root of discoverMountedContentRoots()) {
            this.registerContentRoot(root);
        }
        return Array.from(this.observers.keys()).some((root) => root.isConnected);
    }

    private removeDisconnectedRoots(): void {
        for (const [content] of this.contentStates) {
            if (!content.isConnected) {
                this.unregisterContent(content);
            }
        }
        for (const root of this.observers.keys()) {
            if (!root.isConnected) {
                this.unregisterContentRoot(root);
            }
        }
    }

    private scheduleStartupDiscovery(): void {
        if (
            this.startupDiscoveryFrame !== undefined
            || this.startupDiscoveryTimer !== undefined
        ) {
            return;
        }

        const afterFrame = (): void => {
            this.startupDiscoveryFrame = undefined;
            this.startupDiscoveryTimer = undefined;
            if (!this.started || this.discoverExistingContentRoots()) {
                return;
            }
            this.startupDiscoveryTimer = window.setTimeout(() => {
                this.startupDiscoveryTimer = undefined;
                if (this.started) {
                    this.discoverExistingContentRoots();
                }
            }, STARTUP_FINAL_DISCOVERY_DELAY_MS);
        };

        if (typeof window.requestAnimationFrame === "function") {
            this.startupDiscoveryFrame = window.requestAnimationFrame(afterFrame);
        } else {
            this.startupDiscoveryTimer = window.setTimeout(afterFrame, 0);
        }
    }

    private cancelStartupDiscovery(): void {
        if (this.startupDiscoveryFrame !== undefined) {
            window.cancelAnimationFrame(this.startupDiscoveryFrame);
            this.startupDiscoveryFrame = undefined;
        }
        if (this.startupDiscoveryTimer !== undefined) {
            window.clearTimeout(this.startupDiscoveryTimer);
            this.startupDiscoveryTimer = undefined;
        }
    }

    private unregisterContent(content: HTMLElement): void {
        const state = this.contentStates.get(content);
        if (!state) {
            return;
        }
        state.observer.disconnect();
        for (const root of state.roots) {
            this.unregisterContentRoot(root);
        }
        this.contentStates.delete(content);
    }

    private unregisterContentRoot(root: HTMLElement): void {
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
                const markedAsTask = mutation.target.getAttribute(TASK_BLOCK_ATTRIBUTES.card) === "true";
                if (!markedAsTask) {
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
            if (mutation.removedNodes.length > 0) {
                state.cleanupRequested = true;
            }
            for (const addedNode of mutation.addedNodes) {
                if (isTaskCardDecoration(addedNode)) {
                    continue;
                }
                state.pendingNodes.add(addedNode);
            }
        }

        if (
            state.pendingNodes.size === 0
            && state.forcedBlocks.size === 0
            && !state.cleanupRequested
        ) {
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
            const cleanupRequested = state.cleanupRequested;
            state.pendingNodes.clear();
            state.forcedBlocks.clear();
            state.cleanupRequested = false;
            if (cleanupRequested) {
                this.enhancer.cleanup(state.root);
            }
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
