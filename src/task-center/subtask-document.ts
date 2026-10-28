import type { NormalizedTaskData } from "../domain/validation";
import type { CreateTaskRequest, TaskCreationResult } from "../task-card/create-task";
import type { TaskCenterItem } from "./task-center-data";

/**
 * 子任务独立成子文档。
 *
 * 任务中心里的层级仍然由 `custom-ticktick-parent` 决定；这里只决定任务块「住」在
 * 哪篇文档：新建一篇父任务所在文档的子文档，把任务块放在子文档顶部。
 * 这样文件树里也能看到项目 → 子任务的层级，并且子任务可以拥有自己的正文。
 */
export type SubtaskDocumentApi = {
    createDocument(notebookId: string, path: string, markdown: string): Promise<string>;
    removeDocument(documentId: string): Promise<void>;
    listChildDocuments(
        notebookId: string,
        path: string,
    ): Promise<readonly { title: string }[]>;
    createTaskBlock(request: CreateTaskRequest): Promise<TaskCreationResult>;
    getChildBlocks(blockId: string): Promise<readonly ChildBlock[]>;
    deleteBlock(blockId: string): Promise<void>;
};

type ChildBlock = {
    id: string;
    type: string;
    content: string;
};

export type CreatedSubtaskDocument = {
    documentId: string;
    documentPath: string;
    documentName: string;
    blockId: string;
};

export type SubtaskDocumentErrorCode =
    | "missing-notebook"
    | "missing-document-path"
    | "child-list-failed"
    | "document-create-failed"
    | "block-create-failed"
    | "rollback-failed";

export class SubtaskDocumentError extends Error {
    constructor(
        public readonly code: SubtaskDocumentErrorCode,
        public readonly originalError?: unknown,
        public readonly rollbackError?: unknown,
    ) {
        super(code);
        this.name = "SubtaskDocumentError";
    }
}

const MAX_DOCUMENT_NAME_LENGTH = 120;
const FALLBACK_DOCUMENT_NAME = "Subtask";

export async function createSubtaskDocument(
    api: SubtaskDocumentApi,
    parent: TaskCenterItem,
    task: NormalizedTaskData,
    taskLabel: string,
): Promise<CreatedSubtaskDocument> {
    if (!parent.notebookId) {
        throw new SubtaskDocumentError("missing-notebook");
    }
    const parentHumanPath = normalizePath(parent.documentPath);
    const parentStoragePath = parent.documentFilePath.trim();
    if (parentHumanPath === "" || parentStoragePath === "") {
        throw new SubtaskDocumentError("missing-document-path");
    }

    let childNames: readonly { title: string }[];
    try {
        // listDocsByPath 需要文档的存储路径，不是人类可读路径。
        childNames = await api.listChildDocuments(parent.notebookId, parentStoragePath);
    } catch (error) {
        throw new SubtaskDocumentError("child-list-failed", error);
    }
    const documentName = makeUniqueDocumentName(task.title, childNames);
    const documentPath = parentHumanPath === "/"
        ? `/${documentName}`
        : `${parentHumanPath}/${documentName}`;

    let documentId: string;
    try {
        documentId = await api.createDocument(parent.notebookId, documentPath, "");
    } catch (error) {
        throw new SubtaskDocumentError("document-create-failed", error);
    }

    try {
        const created = await api.createTaskBlock({
            rootDocumentId: documentId,
            parentBlockId: parent.blockId,
            placement: "document-top",
            taskLabel,
            task,
        });
        await removeEmptyParagraphs(api, documentId, created.blockId);
        return {
            documentId,
            documentPath,
            documentName,
            blockId: created.blockId,
        };
    } catch (error) {
        try {
            await api.removeDocument(documentId);
        } catch (rollbackError) {
            throw new SubtaskDocumentError("rollback-failed", error, rollbackError);
        }
        throw new SubtaskDocumentError("block-create-failed", error);
    }
}

export function sanitizeDocumentName(title: string): string {
    const cleaned = title
        .replace(/[\\/:*?"<>|]/g, "／")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_DOCUMENT_NAME_LENGTH)
        .trim();
    return cleaned === "" ? FALLBACK_DOCUMENT_NAME : cleaned;
}

export function makeUniqueDocumentName(
    title: string,
    existing: readonly { title: string }[],
): string {
    const base = sanitizeDocumentName(title);
    const used = new Set(existing.map((item) => item.title));
    if (!used.has(base)) {
        return base;
    }
    for (let suffix = 2; suffix < 10_000; suffix += 1) {
        const candidate = `${base} ${suffix}`;
        if (!used.has(candidate)) {
            return candidate;
        }
    }
    return `${base} ${Date.now()}`;
}

/**
 * createDocWithMd 用空 markdown 建文档时会留下一个空段落；任务块插进去后把它删掉。
 * 这是清理动作，失败也不影响已经创建好的任务，最多留下一个空行。
 */
async function removeEmptyParagraphs(
    api: SubtaskDocumentApi,
    documentId: string,
    taskBlockId: string,
): Promise<void> {
    let children: readonly ChildBlock[];
    try {
        children = await api.getChildBlocks(documentId);
    } catch {
        return;
    }
    for (const child of children) {
        if (child.id === taskBlockId || child.type !== "p" || child.content.trim() !== "") {
            continue;
        }
        try {
            await api.deleteBlock(child.id);
        } catch {
            // 任务已经建好，空段落清理失败不值得让整个创建失败。
        }
    }
}

function normalizePath(path: string): string {
    const trimmed = path.trim();
    if (trimmed === "") {
        return "";
    }
    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeadingSlash.length > 1
        ? withLeadingSlash.replace(/\/+$/, "")
        : "/";
}
