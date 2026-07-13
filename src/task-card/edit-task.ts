import {
    createTaskBlockAttributes,
    createTaskFallbackMarkdown,
    type PersistedTickTickTaskData,
} from "../domain/task";
import type { NormalizedTaskData } from "../domain/validation";
import { parseTaskBlockAttributes } from "./task-data";

export type TaskEditApi = {
    loadAttributes(blockId: string): Promise<Record<string, unknown>>;
    updateMarkdownBlock(blockId: string, markdown: string): Promise<void>;
    setBlockAttributes(blockId: string, attrs: Record<string, string>): Promise<void>;
};

export type EditTaskRequest = {
    blockId: string;
    original: PersistedTickTickTaskData;
    taskLabel: string;
    next: NormalizedTaskData;
};

export type TaskEditErrorCode =
    | "block-unavailable"
    | "current-data-invalid"
    | "edit-conflict"
    | "content-update-failed"
    | "attribute-write-failed"
    | "rollback-failed";

export class TaskEditError extends Error {
    constructor(
        public readonly code: TaskEditErrorCode,
        public readonly blockId: string,
        public readonly originalError?: unknown,
        public readonly rollbackError?: unknown,
        public readonly currentUpdatedAt?: string,
        public readonly snapshotUpdatedAt?: string,
    ) {
        super(code);
        this.name = "TaskEditError";
    }
}

export type EditTaskResult =
    | { changed: false; data: PersistedTickTickTaskData }
    | { changed: true; data: PersistedTickTickTaskData };

export async function editTask(
    api: TaskEditApi,
    request: EditTaskRequest,
    now: () => Date = () => new Date(),
): Promise<EditTaskResult> {
    let attributes: Record<string, unknown>;
    try {
        attributes = await api.loadAttributes(request.blockId);
    } catch (error) {
        throw new TaskEditError("block-unavailable", request.blockId, error);
    }

    const parsed = parseTaskBlockAttributes(attributes);
    if (!parsed.valid) {
        throw new TaskEditError("current-data-invalid", request.blockId, parsed.reason);
    }
    const current = parsed.data;

    if (current.updatedAt !== request.original.updatedAt) {
        throw new TaskEditError(
            "edit-conflict",
            request.blockId,
            undefined,
            undefined,
            current.updatedAt,
            request.original.updatedAt,
        );
    }

    const titleChanged = current.title !== request.next.title;
    const urlChanged = current.url !== request.next.url;
    const statusChanged = current.status !== request.next.status;
    if (!titleChanged && !urlChanged && !statusChanged) {
        return { changed: false, data: current };
    }

    let nextData: PersistedTickTickTaskData;
    try {
        nextData = {
            version: current.version,
            title: request.next.title,
            url: request.next.url,
            status: request.next.status,
            createdAt: current.createdAt,
            updatedAt: now().toISOString(),
        };
    } catch (error) {
        throw new TaskEditError("attribute-write-failed", request.blockId, error);
    }
    const nextAttributes = createTaskBlockAttributes(nextData);

    if (!titleChanged && !urlChanged) {
        try {
            await api.setBlockAttributes(request.blockId, nextAttributes);
        } catch (error) {
            throw new TaskEditError("attribute-write-failed", request.blockId, error);
        }
        return { changed: true, data: nextData };
    }

    const nextMarkdown = createTaskFallbackMarkdown(
        request.taskLabel,
        nextData.title,
        nextData.url,
    );
    try {
        await api.updateMarkdownBlock(request.blockId, nextMarkdown);
    } catch (error) {
        throw new TaskEditError("content-update-failed", request.blockId, error);
    }

    try {
        await api.setBlockAttributes(request.blockId, nextAttributes);
    } catch (error) {
        const originalMarkdown = createTaskFallbackMarkdown(
            request.taskLabel,
            current.title,
            current.url,
        );
        try {
            await api.updateMarkdownBlock(request.blockId, originalMarkdown);
        } catch (rollbackError) {
            throw new TaskEditError(
                "rollback-failed",
                request.blockId,
                error,
                rollbackError,
            );
        }
        throw new TaskEditError("attribute-write-failed", request.blockId, error);
    }

    return { changed: true, data: nextData };
}
