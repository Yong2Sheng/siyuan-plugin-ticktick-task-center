import type { PersistedTickTickTaskData } from "../domain/task";
import { getLocalDate } from "../domain/local-date";
import type { TaskCenterAggregationResult, TaskCenterItem } from "./task-center-data";
import {
    DEFAULT_TASK_CENTER_FILTER,
    sortTaskCenterItems,
    type TaskCenterFilter,
} from "./task-center-filter";
import {
    serializeFocusPlan,
    setFocusPlanProgress,
    type FocusPlan,
} from "../domain/focus-plan";
import {
    includeLegacyProgressDate,
    serializeProgressLog,
    setProgressLogDate,
    type ProgressLog,
} from "../domain/progress-log";

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
    workMode?: PersistedTickTickTaskData["workMode"];
    deadline?: string;
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
    private readonly recentDailyProgress = new Map<string, string | undefined>();
    private readonly recentProgressLogs = new Map<string, ProgressLog>();
    private readonly recentFocusPlans = new Map<string, FocusPlan>();
    private readonly recentDeletions = new Set<string>();
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
            ...(data.workMode ? { workMode: data.workMode } : {}),
            ...(data.deadline ? { deadline: data.deadline } : {}),
            createdAt: current.createdAt,
            updatedAt: data.updatedAt,
        };
        this.recentEdits.set(blockId, recent);
        const completedDate = current.status !== "completed" && data.status === "completed"
            ? getLocalDate(new Date(data.updatedAt))
            : undefined;
        if (completedDate) {
            this.recentDailyProgress.set(blockId, completedDate);
            this.recentProgressLogs.set(
                blockId,
                setProgressLogDate(
                    includeLegacyProgressDate(
                        current.progressLog ?? { version: 1, dates: [] },
                        current.lastProgressedDate,
                    ),
                    completedDate,
                    true,
                ),
            );
            if (current.focusPlan) {
                this.recentFocusPlans.set(
                    blockId,
                    setFocusPlanProgress(current.focusPlan, completedDate, true),
                );
            }
        }
        const items = sortTaskCenterItems(this.state.items.map((item) => (
            item.blockId === blockId
                ? applyEditedTask(item, recent, completedDate)
                : item
        )));
        this.update({ items });
        return true;
    }

    applyDailyProgress(
        blockId: string,
        date: string | undefined,
        savedProgressLog?: ProgressLog,
    ): boolean {
        if (this.destroyed) {
            return false;
        }
        const current = this.state.items.find((item) => item.blockId === blockId);
        if (!current) {
            this.options.onWarning?.(
                `Updated daily progress for TickTick task ${blockId} was not found in the current task center`,
            );
            return false;
        }

        this.recentDailyProgress.set(blockId, date);
        const changedDate = date ?? current.lastProgressedDate;
        const progressLog = savedProgressLog ?? (changedDate
            ? setProgressLogDate(
                includeLegacyProgressDate(
                    current.progressLog ?? { version: 1, dates: [] },
                    current.lastProgressedDate,
                ),
                changedDate,
                date !== undefined,
            )
            : current.progressLog ?? { version: 1, dates: [] });
        this.recentProgressLogs.set(blockId, progressLog);
        this.update({
            items: this.state.items.map((item) => (
                item.blockId === blockId
                    ? applyRecentProgressLog(applyRecentDailyProgress(item, date), progressLog)
                    : item
            )),
        });
        return true;
    }

    applyDailyProgressWithFocus(
        blockId: string,
        date: string | undefined,
        focusPlan: FocusPlan | undefined,
        progressLog?: ProgressLog,
    ): boolean {
        const applied = this.applyDailyProgress(blockId, date, progressLog);
        if (applied && focusPlan) {
            this.recentFocusPlans.set(blockId, focusPlan);
            this.update({
                items: this.state.items.map((item) => (
                    item.blockId === blockId ? applyRecentFocusPlan(item, focusPlan) : item
                )),
            });
        }
        return applied;
    }

    applyFocusPlan(blockId: string, focusPlan: FocusPlan): boolean {
        if (this.destroyed) {
            return false;
        }
        const current = this.state.items.find((item) => item.blockId === blockId);
        if (!current) {
            this.options.onWarning?.(
                `Updated focus plan for TickTick task ${blockId} was not found in the current task center`,
            );
            return false;
        }
        this.recentFocusPlans.set(blockId, focusPlan);
        this.update({
            items: this.state.items.map((item) => (
                item.blockId === blockId ? applyRecentFocusPlan(item, focusPlan) : item
            )),
        });
        return true;
    }

    applyDeletedTask(blockId: string): boolean {
        if (this.destroyed) {
            return false;
        }
        const exists = this.state.items.some((item) => item.blockId === blockId);
        this.recentEdits.delete(blockId);
        this.recentDailyProgress.delete(blockId);
        this.recentProgressLogs.delete(blockId);
        this.recentFocusPlans.delete(blockId);
        this.recentDeletions.add(blockId);
        if (exists) {
            this.update({
                items: this.state.items.filter((item) => item.blockId !== blockId),
            });
        }
        return exists;
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
        this.recentDailyProgress.clear();
        this.recentProgressLogs.clear();
        this.recentFocusPlans.clear();
        this.recentDeletions.clear();
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
        for (const [blockId, date] of this.recentDailyProgress) {
            const sqlItem = merged.get(blockId);
            if (!sqlItem) {
                this.recentDailyProgress.delete(blockId);
                continue;
            }
            if (sqlItem.lastProgressedDate === date) {
                this.recentDailyProgress.delete(blockId);
                continue;
            }
            merged.set(blockId, applyRecentDailyProgress(sqlItem, date));
        }
        for (const [blockId, progressLog] of this.recentProgressLogs) {
            const sqlItem = merged.get(blockId);
            if (!sqlItem) {
                this.recentProgressLogs.delete(blockId);
                continue;
            }
            if (serializeProgressLog(sqlItem.progressLog ?? { version: 1, dates: [] })
                === serializeProgressLog(progressLog)) {
                this.recentProgressLogs.delete(blockId);
                continue;
            }
            merged.set(blockId, applyRecentProgressLog(sqlItem, progressLog));
        }
        for (const [blockId, focusPlan] of this.recentFocusPlans) {
            const sqlItem = merged.get(blockId);
            if (!sqlItem) {
                this.recentFocusPlans.delete(blockId);
                continue;
            }
            if (serializeFocusPlan(sqlItem.focusPlan ?? { version: 1, entries: [] })
                === serializeFocusPlan(focusPlan)) {
                this.recentFocusPlans.delete(blockId);
                continue;
            }
            merged.set(blockId, applyRecentFocusPlan(sqlItem, focusPlan));
        }
        for (const blockId of this.recentDeletions) {
            if (!merged.has(blockId)) {
                this.recentDeletions.delete(blockId);
                continue;
            }
            merged.delete(blockId);
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
    const next = {
        ...item,
        title: edit.title,
        url: edit.url,
        status: edit.status,
        updatedAt: edit.updatedAt,
    };
    delete next.workMode;
    if (edit.workMode) {
        next.workMode = edit.workMode;
    }
    delete next.deadline;
    return edit.deadline ? { ...next, deadline: edit.deadline } : next;
}

function applyEditedTask(
    item: TaskCenterItem,
    edit: RecentTaskEdit,
    completedDate: string | undefined,
): TaskCenterItem {
    const edited = applyRecentEdit(item, edit);
    if (!completedDate) {
        return edited;
    }
    const progressed = applyRecentDailyProgress(edited, completedDate);
    const progressLog = setProgressLogDate(
        includeLegacyProgressDate(
            item.progressLog ?? { version: 1, dates: [] },
            item.lastProgressedDate,
        ),
        completedDate,
        true,
    );
    const withProgressLog = applyRecentProgressLog(progressed, progressLog);
    return item.focusPlan
        ? applyRecentFocusPlan(withProgressLog, setFocusPlanProgress(item.focusPlan, completedDate, true))
        : withProgressLog;
}

function applyRecentFocusPlan(item: TaskCenterItem, focusPlan: FocusPlan): TaskCenterItem {
    const next = { ...item };
    delete next.focusPlan;
    return focusPlan.entries.length > 0 ? { ...next, focusPlan } : next;
}

function applyRecentDailyProgress(
    item: TaskCenterItem,
    date: string | undefined,
): TaskCenterItem {
    const next = { ...item };
    delete next.lastProgressedDate;
    return date ? { ...next, lastProgressedDate: date } : next;
}

function applyRecentProgressLog(item: TaskCenterItem, progressLog: ProgressLog): TaskCenterItem {
    const next = { ...item };
    delete next.progressLog;
    return progressLog.dates.length > 0 ? { ...next, progressLog } : next;
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
