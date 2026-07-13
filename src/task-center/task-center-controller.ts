import type { PersistedTickTickTaskData } from "../domain/task";
import type { TaskCenterAggregationResult, TaskCenterItem } from "./task-center-data";
import {
    DEFAULT_TASK_CENTER_FILTER,
    sortTaskCenterItems,
    type TaskCenterFilter,
} from "./task-center-filter";

export type TaskCenterState = {
    items: readonly TaskCenterItem[];
    invalidCount: number;
    incompleteCount: number;
    filter: TaskCenterFilter;
    search: string;
    loading: boolean;
    refreshing: boolean;
    error: boolean;
};

export type TaskCenterControllerOptions = {
    load(): Promise<TaskCenterAggregationResult>;
    onError?: (error: unknown) => void;
    onWarning?: (message: string, detail?: unknown) => void;
};

export type RecentTaskEdit = {
    blockId: string;
    title: string;
    url: string;
    status: PersistedTickTickTaskData["status"];
    createdAt: string;
    updatedAt: string;
};

export class TaskCenterController {
    private state: TaskCenterState = {
        items: [],
        invalidCount: 0,
        incompleteCount: 0,
        filter: DEFAULT_TASK_CENTER_FILTER,
        search: "",
        loading: false,
        refreshing: false,
        error: false,
    };
    private readonly listeners = new Set<(state: TaskCenterState) => void>();
    private readonly recentEdits = new Map<string, RecentTaskEdit>();
    private generation = 0;
    private started = false;
    private hasLoaded = false;
    private destroyed = false;

    constructor(private readonly options: TaskCenterControllerOptions) {}

    async start(): Promise<void> {
        if (this.destroyed || this.started) {
            return;
        }
        this.started = true;
        await this.runLoad();
    }

    async refresh(): Promise<void> {
        if (!this.destroyed) {
            await this.runLoad();
        }
    }

    applyEditedTask(blockId: string, data: PersistedTickTickTaskData): boolean {
        if (this.destroyed) {
            return false;
        }
        const current = this.state.items.find((item) => item.blockId === blockId);
        if (!current) {
            this.options.onWarning?.(
                `Saved TickTick task ${blockId} was not found in the current task center`,
            );
            return false;
        }

        const recent: RecentTaskEdit = {
            blockId,
            title: data.title,
            url: data.url,
            status: data.status,
            createdAt: current.createdAt,
            updatedAt: data.updatedAt,
        };
        this.recentEdits.set(blockId, recent);
        const items = sortTaskCenterItems(this.state.items.map((item) => (
            item.blockId === blockId ? applyRecentEdit(item, recent) : item
        )));
        this.update({ items });
        return true;
    }

    setFilter(filter: TaskCenterFilter): void {
        this.update({ filter });
    }

    setSearch(search: string): void {
        this.update({ search });
    }

    subscribe(listener: (state: TaskCenterState) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getState(): TaskCenterState {
        return this.state;
    }

    destroy(): void {
        this.destroyed = true;
        this.generation += 1;
        this.recentEdits.clear();
        this.listeners.clear();
    }

    private async runLoad(): Promise<void> {
        const generation = ++this.generation;
        this.update({
            loading: !this.hasLoaded,
            refreshing: this.hasLoaded,
            error: false,
        });

        try {
            const result = await this.options.load();
            if (this.destroyed || generation !== this.generation) {
                return;
            }
            const items = this.mergeRecentEdits(result.items);
            this.hasLoaded = true;
            this.update({
                items,
                invalidCount: result.invalidBlocks.length,
                incompleteCount: result.incompleteBlocks.length,
                loading: false,
                refreshing: false,
                error: false,
            });
        } catch (error) {
            if (this.destroyed || generation !== this.generation) {
                return;
            }
            this.options.onError?.(error);
            this.update({ loading: false, refreshing: false, error: true });
        }
    }

    private mergeRecentEdits(sqlItems: readonly TaskCenterItem[]): TaskCenterItem[] {
        const merged = new Map(sqlItems.map((item) => [item.blockId, item]));
        for (const [blockId, recent] of this.recentEdits) {
            const sqlItem = merged.get(blockId);
            if (!sqlItem) {
                this.recentEdits.delete(blockId);
                continue;
            }
            if (isSqlAtLeastAsNew(sqlItem.updatedAt, recent.updatedAt)) {
                this.recentEdits.delete(blockId);
                continue;
            }
            merged.set(blockId, applyRecentEdit(sqlItem, recent));
        }
        return sortTaskCenterItems(Array.from(merged.values()));
    }

    private update(patch: Partial<TaskCenterState>): void {
        if (this.destroyed) {
            return;
        }
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}

export function createTaskCenterEditSession(
    controller: TaskCenterController,
    onUnavailable: () => void,
): {
    apply(blockId: string, data: PersistedTickTickTaskData): void;
    dispose(): void;
} {
    let disposed = false;
    return {
        apply(blockId, data) {
            if (!disposed && !controller.applyEditedTask(blockId, data)) {
                onUnavailable();
            }
        },
        dispose() {
            disposed = true;
        },
    };
}

function applyRecentEdit(item: TaskCenterItem, edit: RecentTaskEdit): TaskCenterItem {
    return {
        ...item,
        title: edit.title,
        url: edit.url,
        status: edit.status,
        updatedAt: edit.updatedAt,
    };
}

function isSqlAtLeastAsNew(sqlUpdatedAt: string, recentUpdatedAt: string): boolean {
    if (sqlUpdatedAt === recentUpdatedAt) {
        return true;
    }
    const sqlTime = Date.parse(sqlUpdatedAt);
    const recentTime = Date.parse(recentUpdatedAt);
    return Number.isFinite(sqlTime)
        && Number.isFinite(recentTime)
        && sqlTime > recentTime;
}
