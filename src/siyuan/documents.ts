import { isSiYuanId } from "../domain/siyuan-id";
import { requestSiYuan } from "./api";

export type ChildDocument = {
    id: string;
    path: string;
    title: string;
    subFileCount: number;
    createdAt?: string;
    updatedAt?: string;
};

type UnknownRecord = Record<string, unknown>;

export async function listChildDocuments(
    notebookId: string,
    path: string,
): Promise<ChildDocument[]> {
    const response = await requestSiYuan<unknown>("/api/filetree/listDocsByPath", {
        notebook: notebookId,
        path,
        maxListCount: 0,
        ignoreMaxListHint: true,
    });
    if (!isRecord(response) || !Array.isArray(response.files)) {
        throw new Error("SiYuan listDocsByPath response was not a document list");
    }

    return response.files.flatMap((value) => {
        if (!isRecord(value)) {
            return [];
        }
        const id = readString(value.id);
        const documentPath = readString(value.path);
        if (!isSiYuanId(id) || documentPath === "") {
            return [];
        }
        const subFileCount = readNonNegativeInteger(value.subFileCount);
        const createdAt = readEpochSeconds(value.ctime);
        const updatedAt = readEpochSeconds(value.mtime);
        return [{
            id,
            path: documentPath,
            title: readString(value.name).trim() || id,
            subFileCount,
            ...(createdAt ? { createdAt } : {}),
            ...(updatedAt ? { updatedAt } : {}),
        }];
    });
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function readNonNegativeInteger(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function readEpochSeconds(value: unknown): string | undefined {
    const seconds = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return undefined;
    }
    return new Date(seconds * 1000).toISOString();
}

export type NotebookSummary = {
    id: string;
    name: string;
};

export async function listNotebooks(): Promise<NotebookSummary[]> {
    const response = await requestSiYuan<unknown>("/api/notebook/lsNotebooks", {});
    if (!isRecord(response) || !Array.isArray(response.notebooks)) {
        throw new Error("SiYuan lsNotebooks response was not a notebook list");
    }

    return response.notebooks.flatMap((value) => {
        if (!isRecord(value) || value.closed === true) {
            return [];
        }
        const id = readString(value.id);
        if (!isSiYuanId(id)) {
            return [];
        }
        return [{ id, name: readString(value.name).trim() || id }];
    });
}

export type DocumentSearchHit = {
    id: string;
    notebookId: string;
    name: string;
    /** 笔记本内的可读路径，例如 /Proposals/Chandra。 */
    humanPath: string;
};

export async function searchDocuments(keyword: string): Promise<DocumentSearchHit[]> {
    const query = keyword.trim();
    if (query === "") {
        return [];
    }
    const response = await requestSiYuan<unknown>("/api/filetree/searchDocs", { k: query });
    if (!Array.isArray(response)) {
        throw new Error("SiYuan searchDocs response was not a document list");
    }

    const hits: DocumentSearchHit[] = [];
    for (const value of response) {
        if (!isRecord(value)) {
            continue;
        }
        const id = documentIdFromPath(readString(value.path));
        const notebookId = readString(value.box);
        if (!id || !isSiYuanId(notebookId)) {
            continue;
        }
        hits.push({
            id,
            notebookId,
            name: lastPathSegment(readString(value.hPath)) || id,
            humanPath: await readDocumentHumanPath(notebookId, readString(value.path)),
        });
    }
    return hits;
}

export async function readDocumentHumanPath(
    notebookId: string,
    filePath: string,
): Promise<string> {
    if (filePath.trim() === "") {
        return "";
    }
    const response = await requestSiYuan<unknown>("/api/filetree/getHPathByPath", {
        notebook: notebookId,
        path: filePath,
    });
    return typeof response === "string" ? response : "";
}

/** 用 Markdown 在指定路径新建文档，返回新文档 ID。 */
export async function createDocument(
    notebookId: string,
    path: string,
    markdown: string,
): Promise<string> {
    const response = await requestSiYuan<unknown>("/api/filetree/createDocWithMd", {
        notebook: notebookId,
        path,
        markdown,
    });
    if (!isSiYuanId(response)) {
        throw new Error("SiYuan createDocWithMd response did not contain a document ID");
    }
    return response;
}

/** 把文档移到思源回收站（可恢复），用于创建子任务失败时回滚空文档。 */
export async function removeDocument(documentId: string): Promise<void> {
    await requestSiYuan<unknown>("/api/filetree/removeDocByID", {
        id: documentId,
    });
}

function documentIdFromPath(filePath: string): string {
    const name = filePath.split("/").filter(Boolean).at(-1) ?? "";
    const id = name.endsWith(".sy") ? name.slice(0, -3) : name;
    return isSiYuanId(id) ? id : "";
}

function lastPathSegment(path: string): string {
    return path.split("/").filter(Boolean).at(-1) ?? "";
}
