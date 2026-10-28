import {
    createTaskBlockAttributes,
    createTaskFallbackMarkdown,
    TASK_BLOCK_OPTIONAL_ATTRIBUTES,
    TASK_DATA_VERSION,
} from "../domain/task";
import type { NormalizedTaskData } from "../domain/validation";

export type TaskCreationApi = {
    prependMarkdownBlock(parentId: string, markdown: string): Promise<string>;
    insertMarkdownBlockAfter(previousBlockId: string, markdown: string): Promise<string>;
    setBlockAttributes(blockId: string, attrs: Record<string, string>): Promise<void>;
    deleteBlock(blockId: string): Promise<void>;
};

export type CreateTaskRequest = {
    rootDocumentId: string;
    /** 子任务的父任务块 id；只用于写入父级属性。 */
    parentBlockId?: string;
    /**
     * 任务块放到哪里：
     * - after-parent：插到父任务块后面（旧模式，父子块在同一个文档）；
     * - document-top：放到 rootDocumentId 文档顶部（子任务独立成子文档时使用）。
     * 未指定时，有 parentBlockId 就按 after-parent，否则 document-top。
     */
    placement?: "after-parent" | "document-top";
    taskLabel: string;
    task: NormalizedTaskData;
};

export type TaskCreationResult = {
    blockId: string;
    updatedAt: string;
};

export type TaskCreationErrorCode =
    | "insert-failed"
    | "attribute-write-failed"
    | "rollback-failed";

export class TaskCreationError extends Error {
    constructor(
        public readonly code: TaskCreationErrorCode,
        public readonly blockId?: string,
        public readonly originalError?: unknown,
        public readonly rollbackError?: unknown,
    ) {
        super(code);
        this.name = "TaskCreationError";
    }
}

export async function createTaskBlock(
    api: TaskCreationApi,
    request: CreateTaskRequest,
    now: () => Date = () => new Date(),
): Promise<TaskCreationResult> {
    const markdown = createTaskFallbackMarkdown(
        request.taskLabel,
        request.task.title,
        request.task.url,
    );

    const placement = request.placement
        ?? (request.parentBlockId ? "after-parent" : "document-top");
    let blockId: string;
    try {
        blockId = placement === "after-parent" && request.parentBlockId
            ? await api.insertMarkdownBlockAfter(request.parentBlockId, markdown)
            : await api.prependMarkdownBlock(request.rootDocumentId, markdown);
    } catch (error) {
        throw new TaskCreationError("insert-failed", undefined, error);
    }

    let timestamp: string;
    try {
        timestamp = now().toISOString();
        const attributes = {
            ...createTaskBlockAttributes({
                version: TASK_DATA_VERSION,
                title: request.task.title,
                url: request.task.url,
                status: request.task.status,
                workMode: request.task.workMode,
                ...(request.task.priority ? { priority: request.task.priority } : {}),
                ...(request.task.deadline ? { deadline: request.task.deadline } : {}),
                createdAt: timestamp,
                updatedAt: timestamp,
            }),
            ...(request.parentBlockId
                ? { [TASK_BLOCK_OPTIONAL_ATTRIBUTES.parent]: request.parentBlockId }
                : {}),
        };
        await api.setBlockAttributes(blockId, attributes);
    } catch (error) {
        try {
            await api.deleteBlock(blockId);
        } catch (rollbackError) {
            throw new TaskCreationError("rollback-failed", blockId, error, rollbackError);
        }
        throw new TaskCreationError("attribute-write-failed", blockId, error);
    }

    return { blockId, updatedAt: timestamp };
}
