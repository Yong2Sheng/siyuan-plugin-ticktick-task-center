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

export type PersistedTickTickTaskData = TickTickTaskCardData & {
    createdAt: string;
    updatedAt: string;
};

export type TaskBlockAttributes = Record<
    (typeof TASK_BLOCK_ATTRIBUTES)[keyof typeof TASK_BLOCK_ATTRIBUTES],
    string
>;

export function escapeMarkdownLinkTitle(title: string): string {
    return title
        .replace(/\\/g, "\\\\")
        .replace(/\r\n|\r|\n/g, " ")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]");
}

/** Plain-block fallback shown while the plugin is disabled or unavailable. */
export function createTaskFallbackMarkdown(label: string, title: string, url: string): string {
    return `${label}：[${escapeMarkdownLinkTitle(title)}](${url})`;
}

export function createTaskBlockAttributes(data: PersistedTickTickTaskData): TaskBlockAttributes {
    return {
        [TASK_BLOCK_ATTRIBUTES.card]: "true",
        [TASK_BLOCK_ATTRIBUTES.version]: String(TASK_DATA_VERSION),
        [TASK_BLOCK_ATTRIBUTES.title]: data.title,
        [TASK_BLOCK_ATTRIBUTES.url]: data.url,
        [TASK_BLOCK_ATTRIBUTES.status]: data.status,
        [TASK_BLOCK_ATTRIBUTES.createdAt]: data.createdAt,
        [TASK_BLOCK_ATTRIBUTES.updatedAt]: data.updatedAt,
    };
}
