import { isSiYuanId } from "../domain/siyuan-id";

/**
 * 任务中心的视图状态（不是任务数据）。
 *
 * 列表模式、折叠状态、项目图坐标都不属于任务块本身，放在插件数据里：
 * 不污染任务属性面板、拖动节点不会反复写文档、也不随单篇文档导出。
 */
export const TASK_CENTER_VIEW_STATE_FILE = "task-center-view.json";
export const TASK_CENTER_VIEW_STATE_VERSION = 1;
export const MAX_VIEW_STATE_COLLAPSED = 5000;
export const MAX_VIEW_STATE_POSITIONS = 5000;
const MAX_POSITION_COORDINATE = 1_000_000;

export type TaskListViewMode = "today" | "project";

export type TaskMapPosition = {
    x: number;
    y: number;
};

export type TaskCenterViewState = {
    version: typeof TASK_CENTER_VIEW_STATE_VERSION;
    listMode: TaskListViewMode;
    collapsed: string[];
    positions: Record<string, TaskMapPosition>;
};

export type ParsedTaskCenterViewState = {
    state: TaskCenterViewState;
    /** 版本不认识时为 true：只读，避免旧版本覆盖新版本写下的布局。 */
    unsupportedVersion: boolean;
};

export function defaultTaskCenterViewState(): TaskCenterViewState {
    return {
        version: TASK_CENTER_VIEW_STATE_VERSION,
        listMode: "today",
        collapsed: [],
        positions: {},
    };
}

export function parseTaskCenterViewState(raw: unknown): ParsedTaskCenterViewState {
    if (!isRecord(raw)) {
        return { state: defaultTaskCenterViewState(), unsupportedVersion: false };
    }
    if (raw.version !== TASK_CENTER_VIEW_STATE_VERSION) {
        return { state: defaultTaskCenterViewState(), unsupportedVersion: true };
    }

    const listMode = raw.listMode === "project" ? "project" : "today";
    const collapsed = parseCollapsed(raw.collapsed);
    const positions = parsePositions(raw.positions);
    return {
        state: {
            version: TASK_CENTER_VIEW_STATE_VERSION,
            listMode,
            collapsed,
            positions,
        },
        unsupportedVersion: false,
    };
}

function parseCollapsed(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const result: string[] = [];
    const seen = new Set<string>();
    for (const value of raw) {
        if (result.length >= MAX_VIEW_STATE_COLLAPSED) {
            break;
        }
        if (!isSiYuanId(value) || seen.has(value)) {
            continue;
        }
        seen.add(value);
        result.push(value);
    }
    return result;
}

function parsePositions(raw: unknown): Record<string, TaskMapPosition> {
    if (!isRecord(raw)) {
        return {};
    }
    const result: Record<string, TaskMapPosition> = {};
    let count = 0;
    for (const [blockId, value] of Object.entries(raw)) {
        if (count >= MAX_VIEW_STATE_POSITIONS) {
            break;
        }
        if (!isSiYuanId(blockId) || !isRecord(value)) {
            continue;
        }
        const { x, y } = value;
        if (!isFiniteCoordinate(x) || !isFiniteCoordinate(y)) {
            continue;
        }
        result[blockId] = { x, y };
        count += 1;
    }
    return result;
}

function isFiniteCoordinate(value: unknown): value is number {
    return typeof value === "number"
        && Number.isFinite(value)
        && Math.abs(value) <= MAX_POSITION_COORDINATE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type TaskCenterViewStateApi = {
    loadData(file: string): Promise<unknown>;
    saveData(file: string, value: unknown): Promise<unknown>;
};

export type TaskCenterViewStateStoreOptions = {
    onError?(error: unknown): void;
};

/**
 * 视图状态的读写。读失败或格式不认识时退回默认值；写失败只报告，不阻断界面。
 * 版本不认识时进入只读模式，避免旧版本把新版本的布局覆盖掉。
 */
export class TaskCenterViewStateStore {
    private readOnly = false;
    private queue: Promise<void> = Promise.resolve();

    constructor(
        private readonly api: TaskCenterViewStateApi,
        private readonly options: TaskCenterViewStateStoreOptions = {},
    ) {}

    async load(): Promise<TaskCenterViewState> {
        try {
            const parsed = parseTaskCenterViewState(
                await this.api.loadData(TASK_CENTER_VIEW_STATE_FILE),
            );
            this.readOnly = parsed.unsupportedVersion;
            return parsed.state;
        } catch (error) {
            this.options.onError?.(error);
            return defaultTaskCenterViewState();
        }
    }

    save(state: TaskCenterViewState): Promise<void> {
        if (this.readOnly) {
            return Promise.resolve();
        }
        this.queue = this.queue
            .then(async () => {
                await this.api.saveData(TASK_CENTER_VIEW_STATE_FILE, state);
            })
            .catch((error: unknown) => {
                this.options.onError?.(error);
            });
        return this.queue;
    }
}
