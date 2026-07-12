import { requestSiYuan } from "./api";

export type BlockAttributes = Record<string, string>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
}

export function isSiYuanId(value: unknown): value is string {
    return typeof value === "string" && /^\d{14}-[a-z0-9]{7}$/.test(value);
}

function readInsertedBlockId(response: unknown): string | null {
    if (!Array.isArray(response)) {
        return null;
    }

    for (const transaction of response) {
        if (!isRecord(transaction) || !Array.isArray(transaction.doOperations)) {
            continue;
        }
        for (const operation of transaction.doOperations) {
            if (
                isRecord(operation)
                && operation.action === "insert"
                && isSiYuanId(operation.id)
            ) {
                return operation.id;
            }
        }
    }

    return null;
}

export type RootDocumentInfo = {
    title: string;
};

export async function getRootDocumentInfo(documentId: string): Promise<RootDocumentInfo | null> {
    const response = await requestSiYuan<unknown>("/api/attr/getBlockAttrs", {
        id: documentId,
    });

    if (!isRecord(response) || response.type !== "doc") {
        return null;
    }

    return {
        title: typeof response.title === "string" ? response.title : "",
    };
}

export async function prependMarkdownBlock(parentId: string, markdown: string): Promise<string> {
    const response = await requestSiYuan<unknown>("/api/block/prependBlock", {
        dataType: "markdown",
        data: markdown,
        parentID: parentId,
    });
    const blockId = readInsertedBlockId(response);

    if (blockId === null) {
        throw new Error("SiYuan prependBlock response did not contain an inserted block ID");
    }

    return blockId;
}

export async function setBlockAttributes(blockId: string, attrs: BlockAttributes): Promise<void> {
    await requestSiYuan<null>("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs,
    });
}

export async function deleteBlock(blockId: string): Promise<void> {
    await requestSiYuan<unknown>("/api/block/deleteBlock", {
        id: blockId,
    });
}
