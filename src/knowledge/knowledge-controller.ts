import type { TaskCenterItem } from "../task-center/task-center-data";
import {
    createEmptyKnowledgeIndex,
    type KnowledgeDocumentItem,
    type KnowledgeIndex,
} from "./knowledge-index";
import type { KnowledgeScanReport, KnowledgeScanResult } from "./knowledge-scanner";
import type { KnowledgeFilter } from "./knowledge-status";

export type KnowledgeCenterState = {
    items: readonly KnowledgeDocumentItem[];
    lastScannedAt?: string;
    search: string;
    filter: KnowledgeFilter;
    loading: boolean;
    scanning: boolean;
    loadError: boolean;
    scanError: boolean;
    /** 块属性写入或读回复核失败；条目状态未改变。 */
    saveError: boolean;
    /** 属性已写入，但插件缓存保存失败；重新扫描可恢复。 */
    cacheError: boolean;
    savingIds: ReadonlySet<string>;
    lastReport?: KnowledgeScanReport;
};

export type KnowledgeCenterControllerOptions = {
    loadIndex(): Promise<KnowledgeIndex>;
    saveIndex(index: KnowledgeIndex): Promise<void>;
    loadTasks(): Promise<readonly TaskCenterItem[]>;
    scan(
        tasks: readonly TaskCenterItem[],
        previousIndex: KnowledgeIndex,
    ): Promise<KnowledgeScanResult>;
    writeOrganizedMark(blockId: string, organizedAt: string): Promise<void>;
    clearOrganizedMark(blockId: string): Promise<void>;
    now?(): Date;
    onError?(error: unknown): void;
};

const EMPTY_SAVING_IDS: ReadonlySet<string> = new Set<string>();

export class KnowledgeCenterController {
    private index = createEmptyKnowledgeIndex();
    private state: KnowledgeCenterState = {
        items: [],
        search: "",
        filter: "unorganized",
        loading: false,
        scanning: false,
        loadError: false,
        scanError: false,
        saveError: false,
        cacheError: false,
        savingIds: EMPTY_SAVING_IDS,
    };
    private readonly listeners = new Set<(state: KnowledgeCenterState) => void>();
    private readonly saving = new Set<string>();
    private started = false;
    private destroyed = false;

    constructor(private readonly options: KnowledgeCenterControllerOptions) {}

    async start(): Promise<void> {
        if (this.destroyed || this.started) {
            return;
        }
        this.started = true;
        this.update({ loading: true, loadError: false });
        try {
            this.index = await this.options.loadIndex();
            if (this.destroyed) {
                return;
            }
            this.update({
                items: this.index.documents,
                ...(this.index.lastScannedAt ? { lastScannedAt: this.index.lastScannedAt } : {}),
                loading: false,
                loadError: false,
            });
        } catch (error) {
            if (this.destroyed) {
                return;
            }
            this.options.onError?.(error);
            this.update({ loading: false, loadError: true });
        }
    }

    async scan(): Promise<void> {
        if (this.destroyed || this.state.scanning || this.saving.size > 0) {
            return;
        }
        this.update({ scanning: true, scanError: false });
        try {
            const tasks = await this.options.loadTasks();
            const result = await this.options.scan(tasks, this.index);
            await this.options.saveIndex(result.index);
            if (this.destroyed) {
                return;
            }
            this.index = result.index;
            this.update({
                items: result.index.documents,
                lastScannedAt: result.index.lastScannedAt,
                lastReport: result.report,
                scanning: false,
                loadError: false,
                scanError: false,
                saveError: false,
                cacheError: false,
            });
        } catch (error) {
            if (this.destroyed) {
                return;
            }
            this.options.onError?.(error);
            this.update({ scanning: false, scanError: true });
        }
    }

    setSearch(search: string): void {
        this.update({ search });
    }

    setFilter(filter: KnowledgeFilter): void {
        this.update({ filter });
    }

    /** 标记为已整理，或对已有标记刷新整理时间（「完成补整理」）。 */
    async markOrganized(id: string): Promise<boolean> {
        return this.setOrganized(id, (this.options.now?.() ?? new Date()).toISOString());
    }

    async clearOrganized(id: string): Promise<boolean> {
        return this.setOrganized(id, undefined);
    }

    subscribe(listener: (state: KnowledgeCenterState) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    getState(): KnowledgeCenterState {
        return this.state;
    }

    destroy(): void {
        this.destroyed = true;
        this.saving.clear();
        this.listeners.clear();
    }

    private async setOrganized(id: string, organizedAt: string | undefined): Promise<boolean> {
        if (
            this.destroyed
            || this.state.loading
            || this.state.scanning
            || this.saving.has(id)
        ) {
            return false;
        }
        const item = this.index.documents.find((entry) => entry.id === id);
        if (!item || !item.available) {
            return false;
        }

        this.saving.add(id);
        this.update({
            savingIds: new Set(this.saving),
            saveError: false,
            cacheError: false,
        });

        try {
            if (organizedAt) {
                await this.options.writeOrganizedMark(id, organizedAt);
            } else {
                await this.options.clearOrganizedMark(id);
            }
        } catch (error) {
            this.saving.delete(id);
            if (this.destroyed) {
                return false;
            }
            this.options.onError?.(error);
            this.update({
                savingIds: new Set(this.saving),
                saveError: true,
            });
            return false;
        }

        if (this.destroyed) {
            return false;
        }

        const nextIndex: KnowledgeIndex = {
            ...this.index,
            documents: this.index.documents.map((entry) => (entry.id === id
                ? withOrganizedAt(entry, organizedAt)
                : entry)),
        };
        this.index = nextIndex;
        this.update({ items: nextIndex.documents });

        try {
            await this.options.saveIndex(nextIndex);
        } catch (error) {
            if (this.destroyed) {
                return false;
            }
            this.options.onError?.(error);
            this.update({ cacheError: true });
        }

        this.saving.delete(id);
        if (!this.destroyed) {
            this.update({ savingIds: new Set(this.saving) });
        }
        return true;
    }

    private update(patch: Partial<KnowledgeCenterState>): void {
        if (this.destroyed) {
            return;
        }
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}

function withOrganizedAt(
    item: KnowledgeDocumentItem,
    organizedAt: string | undefined,
): KnowledgeDocumentItem {
    if (organizedAt) {
        return { ...item, organizedAt };
    }
    const rest: KnowledgeDocumentItem = { ...item };
    delete rest.organizedAt;
    return rest;
}
