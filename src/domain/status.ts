export const TASK_STATUS_IDS = [
    "todo",
    "in-progress",
    "waiting",
    "blocked",
    "completed",
    "failed",
    "cancelled",
] as const;

export type TickTickTaskStatus = (typeof TASK_STATUS_IDS)[number];

export type TaskStatusConfig = {
    icon: string;
    labelKey: `status.${string}`;
    terminal: boolean;
};

export const TASK_STATUS_CONFIG = {
    todo: { icon: "⚪", labelKey: "status.todo", terminal: false },
    "in-progress": { icon: "▶️", labelKey: "status.inProgress", terminal: false },
    waiting: { icon: "⏳", labelKey: "status.waiting", terminal: false },
    blocked: { icon: "⛔", labelKey: "status.blocked", terminal: false },
    completed: { icon: "✅", labelKey: "status.completed", terminal: true },
    failed: { icon: "❌", labelKey: "status.failed", terminal: true },
    cancelled: { icon: "⏹️", labelKey: "status.cancelled", terminal: true },
} as const satisfies Record<TickTickTaskStatus, TaskStatusConfig>;

export const NON_TERMINAL_STATUSES = [
    "todo",
    "in-progress",
    "waiting",
    "blocked",
] as const satisfies readonly TickTickTaskStatus[];

export const TERMINAL_STATUSES = [
    "completed",
    "failed",
    "cancelled",
] as const satisfies readonly TickTickTaskStatus[];

const TASK_STATUS_SET = new Set<string>(TASK_STATUS_IDS);

export function isTickTickTaskStatus(value: unknown): value is TickTickTaskStatus {
    return typeof value === "string" && TASK_STATUS_SET.has(value);
}

export function isTerminalStatus(status: TickTickTaskStatus): boolean {
    return TASK_STATUS_CONFIG[status].terminal;
}
