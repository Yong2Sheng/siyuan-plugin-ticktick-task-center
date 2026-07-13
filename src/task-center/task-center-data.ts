import { isSiYuanId } from "../domain/siyuan-id";
import type { TickTickTaskStatus } from "../domain/status";
import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { parseTaskBlockAttributes, type TaskBlockParseFailure } from "../task-card/task-data";

export type TaskCenterItem = {
    blockId: string;
    rootId: string;
    notebookId?: string;
    documentTitle: string;
    documentPath: string;
    title: string;
    url: string;
    status: TickTickTaskStatus;
    createdAt: string;
    updatedAt: string;
};

export type TaskCenterInvalidReason =
    | TaskBlockParseFailure
    | "invalid-block-id"
    | "invalid-root-id";

export type InvalidTaskCenterBlock = {
    blockId: string;
    reason: TaskCenterInvalidReason;
};

export type IncompleteTaskCenterBlock = {
    blockId: string;
    missingAttributes: string[];
};

export type TaskCenterAggregationResult = {
    items: TaskCenterItem[];
    invalidBlocks: InvalidTaskCenterBlock[];
    incompleteBlocks: IncompleteTaskCenterBlock[];
};

type Aggregate = {
    attrs: Record<string, unknown>;
    rootId: unknown;
    notebookId: unknown;
    documentTitle: unknown;
    documentPath: unknown;
};

const TASK_ATTRIBUTE_NAMES = new Set<string>(Object.values(TASK_BLOCK_ATTRIBUTES));

export function aggregateTaskCenterRows(
    rows: readonly Readonly<Record<string, unknown>>[],
): TaskCenterAggregationResult {
    const aggregates = new Map<string, Aggregate>();

    for (const row of rows) {
        const blockId = readString(row.block_id);
        if (blockId === "") {
            continue;
        }

        let aggregate = aggregates.get(blockId);
        if (!aggregate) {
            aggregate = {
                attrs: {},
                rootId: row.root_id,
                notebookId: row.notebook_id,
                documentTitle: row.document_title,
                documentPath: row.document_path,
            };
            aggregates.set(blockId, aggregate);
        }
        for (const attributeName of TASK_ATTRIBUTE_NAMES) {
            const value = row[attributeName];
            if (
                !(attributeName in aggregate.attrs)
                && value !== null
                && value !== undefined
            ) {
                aggregate.attrs[attributeName] = value;
            }
        }
        aggregate.rootId = preferValue(aggregate.rootId, row.root_id);
        aggregate.notebookId = preferValue(aggregate.notebookId, row.notebook_id);
        aggregate.documentTitle = preferValue(aggregate.documentTitle, row.document_title);
        aggregate.documentPath = preferValue(aggregate.documentPath, row.document_path);
    }

    const items: TaskCenterItem[] = [];
    const invalidBlocks: InvalidTaskCenterBlock[] = [];
    const incompleteBlocks: IncompleteTaskCenterBlock[] = [];
    for (const [blockId, aggregate] of aggregates) {
        if (aggregate.attrs[TASK_BLOCK_ATTRIBUTES.card] !== "true") {
            continue;
        }
        const missingAttributes = Array.from(TASK_ATTRIBUTE_NAMES)
            .filter((attribute) => !(attribute in aggregate.attrs));
        if (missingAttributes.length > 0) {
            incompleteBlocks.push({ blockId, missingAttributes });
            continue;
        }
        if (!isSiYuanId(blockId)) {
            invalidBlocks.push({ blockId, reason: "invalid-block-id" });
            continue;
        }

        const rootId = readString(aggregate.rootId);
        if (!isSiYuanId(rootId)) {
            invalidBlocks.push({ blockId, reason: "invalid-root-id" });
            continue;
        }

        const parsed = parseTaskBlockAttributes(aggregate.attrs);
        if (!parsed.valid) {
            invalidBlocks.push({ blockId, reason: parsed.reason });
            continue;
        }

        const documentPath = readString(aggregate.documentPath);
        const rawDocumentTitle = readString(aggregate.documentTitle).trim();
        const notebookId = readString(aggregate.notebookId);
        items.push({
            blockId,
            rootId,
            ...(isSiYuanId(notebookId) ? { notebookId } : {}),
            documentTitle: rawDocumentTitle || lastPathSegment(documentPath) || rootId,
            documentPath,
            title: parsed.data.title,
            url: parsed.data.url,
            status: parsed.data.status,
            createdAt: parsed.data.createdAt,
            updatedAt: parsed.data.updatedAt,
        });
    }

    return { items, invalidBlocks, incompleteBlocks };
}

function readString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function preferValue(current: unknown, next: unknown): unknown {
    return readString(current) === "" && readString(next) !== "" ? next : current;
}

function lastPathSegment(path: string): string {
    return path.split("/").filter(Boolean).at(-1) ?? "";
}
