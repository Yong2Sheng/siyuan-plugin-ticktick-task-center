import type { TickTickTaskStatus } from "./status";
import type { TickTickTaskWorkMode } from "./work-mode";
import { serializeTaskPriority, type TickTickTaskPriority } from "./priority";

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

export const TASK_BLOCK_OPTIONAL_ATTRIBUTES = {
    lastProgressedDate: "custom-ticktick-last-progressed-date",
    progressLog: "custom-ticktick-progress-log",
    deadline: "custom-ticktick-deadline",
    focusPlan: "custom-ticktick-focus-plan",
    workMode: "custom-ticktick-work-mode",
    /**
     * 任务权重（第二维度）。未设置写空字符串，语义等同「正常推进」，
     * 因此加入该属性之前的旧任务无需迁移。
     */
    priority: "custom-ticktick-priority",
    /**
     * 父任务块 id，用于子任务层级。未设置即顶层任务；加入该属性之前的旧任务
     * 天然满足「未设置」，不需要迁移。空字符串同样表示顶层。
     */
    parent: "custom-ticktick-parent",
} as const;

/**
 * 判断任务块属性是否齐全时使用的必需集合。
 *
 * `custom-ticktick-url` 自收件箱功能起变为**可选**：任务可以先没有目标链接，
 * 之后再补。这是放宽约束，不是改变含义——老任务都带合法链接，因此仍然合法，
 * 不需要任何数据迁移。属性名与语义保持已发布的兼容接口不变。
 */
export const REQUIRED_TASK_BLOCK_ATTRIBUTE_NAMES = [
    TASK_BLOCK_ATTRIBUTES.card,
    TASK_BLOCK_ATTRIBUTES.version,
    TASK_BLOCK_ATTRIBUTES.title,
    TASK_BLOCK_ATTRIBUTES.status,
    TASK_BLOCK_ATTRIBUTES.createdAt,
    TASK_BLOCK_ATTRIBUTES.updatedAt,
] as const;

export type RequiredTaskBlockAttributeName =
    (typeof REQUIRED_TASK_BLOCK_ATTRIBUTE_NAMES)[number];

export type OptionalTaskBlockAttributeName =
    | (typeof TASK_BLOCK_ATTRIBUTES)[keyof typeof TASK_BLOCK_ATTRIBUTES]
    | (typeof TASK_BLOCK_OPTIONAL_ATTRIBUTES)[keyof typeof TASK_BLOCK_OPTIONAL_ATTRIBUTES];

export const DEFAULT_TASK_STATUS = "in-progress" satisfies TickTickTaskStatus;
export const DEFAULT_INSERT_POSITION = "document-top" as const;
export const DEFAULT_TASK_CENTER_VIEW = "non-terminal" as const;
export const DEFAULT_TASK_CENTER_SORT = "updated-desc" as const;

export type TickTickTaskCardData = {
    version: typeof TASK_DATA_VERSION;
    title: string;
    url: string;
    status: TickTickTaskStatus;
    workMode?: TickTickTaskWorkMode;
    /** 未设置表示「正常推进」，不是「无权重」。 */
    priority?: TickTickTaskPriority;
    deadline?: string;
    createdAt?: string;
    updatedAt?: string;
};

export type PersistedTickTickTaskData = TickTickTaskCardData & {
    createdAt: string;
    updatedAt: string;
};

export type TaskBlockAttributes = Record<RequiredTaskBlockAttributeName, string>
    & Partial<Record<OptionalTaskBlockAttributeName, string>>;

export function escapeMarkdownLinkTitle(title: string): string {
    return title
        .replace(/\\/g, "\\\\")
        .replace(/\r\n|\r|\n/g, " ")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]");
}

/**
 * 插件不可用时的降级内容。
 *
 * 没有目标链接的任务只写标题——仍然是一段可读、可编辑、可搜索的普通文本，
 * 只是不带链接。这段文本必须与任务标题保持一致，插件靠它修复被序列化的卡片。
 */
export function createTaskFallbackMarkdown(label: string, title: string, url: string): string {
    const safeTitle = escapeMarkdownLinkTitle(title);
    return url.trim() === ""
        ? `${label}：${safeTitle}`
        : `${label}：[${safeTitle}](${url})`;
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
        [TASK_BLOCK_OPTIONAL_ATTRIBUTES.deadline]: data.deadline ?? "",
        [TASK_BLOCK_OPTIONAL_ATTRIBUTES.workMode]: data.workMode ?? "",
        [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: serializeTaskPriority(data.priority),
    };
}
