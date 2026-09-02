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
