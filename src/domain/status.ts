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

export type TaskStatusTone =
    | "neutral"
    | "primary"
    | "waiting"
    | "blocked"
    | "success"
    | "danger"
    | "disabled";

export type TaskStatusConfig = {
    icon: string;
    labelKey: `status.${string}`;
    terminal: boolean;
    tone: TaskStatusTone;
};

export const TASK_STATUS_CONFIG = {
    todo: { icon: "⚪", labelKey: "status.todo", terminal: false, tone: "neutral" },
    "in-progress": { icon: "▶️", labelKey: "status.inProgress", terminal: false, tone: "primary" },
    waiting: { icon: "⏳", labelKey: "status.waiting", terminal: false, tone: "waiting" },
    blocked: { icon: "⛔", labelKey: "status.blocked", terminal: false, tone: "blocked" },
    completed: { icon: "✅", labelKey: "status.completed", terminal: true, tone: "success" },
    failed: { icon: "❌", labelKey: "status.failed", terminal: true, tone: "danger" },
    cancelled: { icon: "⏹️", labelKey: "status.cancelled", terminal: true, tone: "disabled" },
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
