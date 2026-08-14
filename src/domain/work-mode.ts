export const TASK_WORK_MODE_IDS = [
    "explore",
    "build",
    "execute",
    "review",
] as const;

export type TickTickTaskWorkMode = (typeof TASK_WORK_MODE_IDS)[number];

export type TaskWorkModeConfig = {
    icon: string;
    labelKey: `workMode.${string}`;
};

export const TASK_WORK_MODE_CONFIG: Record<TickTickTaskWorkMode, TaskWorkModeConfig> = {
    explore: { icon: "🔭", labelKey: "workMode.explore" },
    build: { icon: "🛠️", labelKey: "workMode.build" },
    execute: { icon: "⚙️", labelKey: "workMode.execute" },
    review: { icon: "🔎", labelKey: "workMode.review" },
};

export function isTickTickTaskWorkMode(value: unknown): value is TickTickTaskWorkMode {
    return typeof value === "string"
        && TASK_WORK_MODE_IDS.includes(value as TickTickTaskWorkMode);
}
