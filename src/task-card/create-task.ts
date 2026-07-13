import {
    createTaskBlockAttributes,
    createTaskFallbackMarkdown,
    TASK_DATA_VERSION,
} from "../domain/task";
import type { NormalizedTaskData } from "../domain/validation";

export type TaskCreationApi = {
    prependMarkdownBlock(parentId: string, markdown: string): Promise<string>;
    setBlockAttributes(blockId: string, attrs: Record<string, string>): Promise<void>;
    deleteBlock(blockId: string): Promise<void>;
};

export type CreateTaskRequest = {
    rootDocumentId: string;
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

    let blockId: string;
    try {
        blockId = await api.prependMarkdownBlock(request.rootDocumentId, markdown);
    } catch (error) {
        throw new TaskCreationError("insert-failed", undefined, error);
    }

    let timestamp: string;
    try {
        timestamp = now().toISOString();
        const attributes = createTaskBlockAttributes({
            version: TASK_DATA_VERSION,
            title: request.task.title,
            url: request.task.url,
            status: request.task.status,
            createdAt: timestamp,
            updatedAt: timestamp,
        });
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
