import { requestSiYuan } from "./api";
import { isSiYuanId } from "../domain/siyuan-id";

export type BlockAttributes = Record<string, string>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
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

export async function getBlockAttributes(blockId: string): Promise<Record<string, unknown>> {
    const response = await requestSiYuan<unknown>("/api/attr/getBlockAttrs", {
        id: blockId,
    });

    if (!isRecord(response)) {
        throw new Error("SiYuan getBlockAttrs response was not an object");
    }

    return response;
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

/** 在指定块后面插入 Markdown，返回新块 ID。 */
export async function insertMarkdownBlockAfter(
    previousBlockId: string,
    markdown: string,
): Promise<string> {
    const response = await requestSiYuan<unknown>("/api/block/insertBlock", {
        dataType: "markdown",
        data: markdown,
        previousID: previousBlockId,
    });
    const blockId = readInsertedBlockId(response);

    if (blockId === null) {
        throw new Error("SiYuan insertBlock response did not contain an inserted block ID");
    }

    return blockId;
}

export type ChildBlock = {
    id: string;
    type: string;
    content: string;
};

/** 直接读取一个块的子块，用于清理新建子文档时产生的空段落。 */
export async function getChildBlocks(blockId: string): Promise<ChildBlock[]> {
    const response = await requestSiYuan<unknown>("/api/block/getChildBlocks", {
        id: blockId,
    });
    if (!Array.isArray(response)) {
        throw new Error("SiYuan getChildBlocks response was not an array");
    }
    return response.flatMap((value) => {
        if (!isRecord(value) || !isSiYuanId(value.id)) {
            return [];
        }
        return [{
            id: value.id,
            type: typeof value.type === "string" ? value.type : "",
            content: typeof value.content === "string" ? value.content : "",
        }];
    });
}

export async function setBlockAttributes(blockId: string, attrs: BlockAttributes): Promise<void> {
    await requestSiYuan<null>("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs,
    });
}

export async function updateMarkdownBlock(blockId: string, markdown: string): Promise<void> {
    await requestSiYuan<unknown>("/api/block/updateBlock", {
        dataType: "markdown",
        data: markdown,
        id: blockId,
    });
}

export async function deleteBlock(blockId: string): Promise<void> {
    await requestSiYuan<unknown>("/api/block/deleteBlock", {
        id: blockId,
    });
}
