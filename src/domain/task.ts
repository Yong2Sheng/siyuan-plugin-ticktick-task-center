import type { TickTickTaskStatus } from "./status";

export const TASK_DATA_VERSION = 1 as const;

export const TASK_BLOCK_ATTRIBUTES = {
    card: "custom-ticktick-card",
    version: "custom-ticktick-version",
    title: "custom-ticktick-title",
    url: "custom-ticktick-url",
    status: "custom-ticktick-status",
    createdAt: "custom-ticktick-created-at",
    updatedAt: "custom-ticktick-updated-at",
} as const;

export const DEFAULT_TASK_STATUS = "in-progress" satisfies TickTickTaskStatus;
export const DEFAULT_INSERT_POSITION = "document-top" as const;
export const DEFAULT_TASK_CENTER_VIEW = "non-terminal" as const;
export const DEFAULT_TASK_CENTER_SORT = "updated-desc" as const;

export type TickTickTaskCardData = {
    version: typeof TASK_DATA_VERSION;
    title: string;
    url: string;
    status: TickTickTaskStatus;
    createdAt?: string;
    updatedAt?: string;
};

/** Plain-block fallback shown while the plugin is disabled or unavailable. */
export function createTaskFallbackMarkdown(label: string, title: string, url: string): string {
    return `${label}：[${title}](${url})`;
}
