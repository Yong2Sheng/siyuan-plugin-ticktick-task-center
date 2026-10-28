import { isSiYuanId } from "../domain/siyuan-id";
import type { TickTickTaskStatus } from "../domain/status";
import {
    REQUIRED_TASK_BLOCK_ATTRIBUTE_NAMES,
    TASK_BLOCK_ATTRIBUTES,
    TASK_BLOCK_OPTIONAL_ATTRIBUTES,
} from "../domain/task";
import { readLocalDate } from "../domain/local-date";
import { parseTaskBlockAttributes, type TaskBlockParseFailure } from "../task-card/task-data";
import type { TickTickTaskWorkMode } from "../domain/work-mode";
import { parseFocusPlanAttribute, type FocusPlan } from "../domain/focus-plan";
import { parseTaskPriorityAttribute, type TickTickTaskPriority } from "../domain/priority";
import { parseProgressLogAttribute, type ProgressLog } from "../domain/progress-log";

export type TaskCenterItem = {
    blockId: string;
    rootId: string;
    notebookId?: string;
    documentTitle: string;
    documentFilePath: string;
    documentPath: string;
    title: string;
    url: string;
    status: TickTickTaskStatus;
    /** 父任务块 id；缺失、空串或非法 id 都按顶层任务处理。 */
    parentBlockId?: string;
    workMode?: TickTickTaskWorkMode;
    /** 未设置表示「正常推进」，排序时按正常档处理。 */
    priority?: TickTickTaskPriority;
    createdAt: string;
    updatedAt: string;
    deadline?: string;
    lastProgressedDate?: string;
    progressLog?: ProgressLog;
    focusPlan?: FocusPlan;
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
    documentFilePath: unknown;
    documentPath: unknown;
};

const REQUIRED_TASK_ATTRIBUTE_NAMES: readonly string[] = REQUIRED_TASK_BLOCK_ATTRIBUTE_NAMES;
const TASK_ATTRIBUTE_NAMES = new Set<string>([
    ...Object.values(TASK_BLOCK_ATTRIBUTES),
    ...Object.values(TASK_BLOCK_OPTIONAL_ATTRIBUTES),
]);

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
                documentFilePath: row.document_file_path,
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
        aggregate.documentFilePath = preferValue(
            aggregate.documentFilePath,
            row.document_file_path,
        );
        aggregate.documentPath = preferValue(aggregate.documentPath, row.document_path);
    }

    const items: TaskCenterItem[] = [];
    const invalidBlocks: InvalidTaskCenterBlock[] = [];
    const incompleteBlocks: IncompleteTaskCenterBlock[] = [];
    for (const [blockId, aggregate] of aggregates) {
        if (aggregate.attrs[TASK_BLOCK_ATTRIBUTES.card] !== "true") {
            continue;
        }
        const missingAttributes = REQUIRED_TASK_ATTRIBUTE_NAMES
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
        const documentFilePath = readString(aggregate.documentFilePath);
        const rawDocumentTitle = readString(aggregate.documentTitle).trim();
        const notebookId = readString(aggregate.notebookId);
        const lastProgressedDate = readLocalDate(
            aggregate.attrs[TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate],
        );
        const deadline = readLocalDate(
            aggregate.attrs[TASK_BLOCK_OPTIONAL_ATTRIBUTES.deadline],
        );
        const parsedPriority = parseTaskPriorityAttribute(
            aggregate.attrs[TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority],
        );
        const priority = parsedPriority.valid ? parsedPriority.priority : undefined;
        const focusPlan = parseFocusPlanAttribute(
            aggregate.attrs[TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan],
        );
        const progressLog = parseProgressLogAttribute(
            aggregate.attrs[TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog],
        );
        // 父级按「块 id」解释；非法值不把整条任务判无效，只是不参与层级，
        // 否则一个手改坏的属性会让任务从任务中心整条消失。
        const rawParentBlockId = aggregate.attrs[TASK_BLOCK_OPTIONAL_ATTRIBUTES.parent];
        const parentBlockId = typeof rawParentBlockId === "string"
            && isSiYuanId(rawParentBlockId)
            ? rawParentBlockId
            : undefined;
        items.push({
            blockId,
            rootId,
            ...(isSiYuanId(notebookId) ? { notebookId } : {}),
            documentTitle: rawDocumentTitle || lastPathSegment(documentPath) || rootId,
            documentFilePath,
            documentPath,
            title: parsed.data.title,
            url: parsed.data.url,
            status: parsed.data.status,
            ...(parentBlockId ? { parentBlockId } : {}),
            ...(parsed.data.workMode ? { workMode: parsed.data.workMode } : {}),
            ...(priority ? { priority } : {}),
            createdAt: parsed.data.createdAt,
            updatedAt: parsed.data.updatedAt,
            ...(deadline ? { deadline } : {}),
            ...(lastProgressedDate ? { lastProgressedDate } : {}),
            ...(progressLog.valid && progressLog.log.dates.length > 0
                ? { progressLog: progressLog.log }
                : {}),
            ...(focusPlan.valid && focusPlan.plan.entries.length > 0
                ? { focusPlan: focusPlan.plan }
                : {}),
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
