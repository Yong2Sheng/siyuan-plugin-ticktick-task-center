import type { NormalizedTaskData } from "../domain/validation";
import type { DocumentTarget } from "./document-picker";

/**
 * 把便条变成真实任务块的唯一动作，两个入口共用。
 *
 * 顺序是硬约束：**先建任务块，再删便条**。反过来一旦建块失败，
 * 便条已经没了，用户在收件箱里写的内容就凭空消失。
 */

export type PromoteTaskApi = {
    createTaskBlock(request: {
        rootDocumentId: string;
        taskLabel: string;
        task: NormalizedTaskData;
    }): Promise<{ blockId: string }>;
    /** 把便条正文写进任务文档（任务块下面）。便条没有正文时不会被调用。 */
    insertNoteBody(blockId: string, markdown: string): Promise<void>;
    removeInboxNote(noteId: string): Promise<boolean>;
};

export type PromoteRequest = {
    rootDocumentId: string;
    taskLabel: string;
    task: NormalizedTaskData;
    /** 便条 id；入口 2 没有选便条时为 undefined。 */
    noteId?: string;
    /** 便条正文（第一段之后的全部内容）；没有正文时缺省。 */
    noteBody?: string;
};

export type PromoteFailure =
    | "document-create-failed"
    | "task-create-failed"
    | "note-body-failed"
    | "note-remove-failed";

export type PromoteResult =
    | { ok: true; blockId: string; noteRemoved: boolean }
    | { ok: false; reason: PromoteFailure; blockId?: string };

export async function promoteToTaskList(
    api: PromoteTaskApi,
    request: PromoteRequest,
): Promise<PromoteResult> {
    let blockId: string;
    try {
        const created = await api.createTaskBlock({
            rootDocumentId: request.rootDocumentId,
            taskLabel: request.taskLabel,
            task: request.task,
        });
        blockId = created.blockId;
    } catch {
        return { ok: false, reason: "task-create-failed" };
    }

    // 正文必须落进任务文档：便条随后就会被删掉，不写进去就等于把它丢了。
    if (request.noteBody !== undefined && request.noteBody.trim() !== "") {
        try {
            await api.insertNoteBody(blockId, request.noteBody);
        } catch {
            // 任务块已经建好了，但正文没写进去。保留便条，什么都不丢，
            // 让用户自己决定是重试还是手动处理。
            return { ok: false, reason: "note-body-failed", blockId };
        }
    }

    if (!request.noteId) {
        return { ok: true, blockId, noteRemoved: false };
    }

    const removed = await api.removeInboxNote(request.noteId);
    if (!removed) {
        // 任务已经建好了，只是便条没删掉。如实报告，既不假装成功，
        // 也不回滚任务块——回滚会把用户刚建好的任务一起弄没。
        return { ok: false, reason: "note-remove-failed", blockId };
    }
    return { ok: true, blockId, noteRemoved: true };
}

export type ResolveTargetApi = {
    createDocument(notebookId: string, path: string, markdown: string): Promise<string>;
};

export type ResolveTargetResult =
    | { ok: true; documentId: string }
    | { ok: false; reason: Extract<PromoteFailure, "document-create-failed"> };

/** 把「目标位置」解析成真实文档 ID；选择新建时先建文档。 */
export async function resolveTargetDocument(
    api: ResolveTargetApi,
    target: DocumentTarget,
): Promise<ResolveTargetResult> {
    if (target.kind === "existing") {
        return { ok: true, documentId: target.documentId };
    }
    try {
        const documentId = await api.createDocument(
            target.parent.notebookId,
            target.path,
            "",
        );
        return { ok: true, documentId };
    } catch {
        return { ok: false, reason: "document-create-failed" };
    }
}

/** 抛出式的包装，供「创建任务」弹窗复用同一套错误语义。 */
export class PromoteTaskError extends Error {
    constructor(
        public readonly reason: PromoteFailure,
        public readonly blockId?: string,
    ) {
        super(reason);
        this.name = "PromoteTaskError";
    }
}

export async function promoteToTaskListOrThrow(
    api: PromoteTaskApi,
    request: PromoteRequest,
): Promise<{ blockId: string }> {
    const result = await promoteToTaskList(api, request);
    if (!result.ok) {
        throw new PromoteTaskError(result.reason, result.blockId);
    }
    return { blockId: result.blockId };
}
