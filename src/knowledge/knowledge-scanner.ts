import type { TaskCenterItem } from "../task-center/task-center-data";
import type { ChildDocument } from "../siyuan/documents";
import {
    KNOWLEDGE_DOCUMENT_ATTRIBUTE,
    KNOWLEDGE_INDEX_VERSION,
    type KnowledgeDocumentItem,
    type KnowledgeIndex,
} from "./knowledge-index";

const ATTRIBUTE_WRITE_CONCURRENCY = 4;

export type KnowledgeScanReport = {
    taskDocumentCount: number;
    examinedDocumentCount: number;
    addedDocumentCount: number;
    existingDocumentCount: number;
    unavailableDocumentCount: number;
    failedDocumentCount: number;
    skippedTaskDocumentCount: number;
};

export type KnowledgeScanResult = {
    index: KnowledgeIndex;
    report: KnowledgeScanReport;
};

export type KnowledgeScannerDependencies = {
    listChildDocuments(notebookId: string, path: string): Promise<ChildDocument[]>;
    setBlockAttributes(blockId: string, attrs: Record<string, string>): Promise<void>;
    getBlockAttributes(blockId: string): Promise<Record<string, unknown>>;
    now?(): Date;
};

type TaskDocument = {
    id: string;
    notebookId: string;
    title: string;
    filePath: string;
    documentPath: string;
};

export async function scanKnowledgeDocuments(
    tasks: readonly TaskCenterItem[],
    previousIndex: KnowledgeIndex,
    dependencies: KnowledgeScannerDependencies,
): Promise<KnowledgeScanResult> {
    const scannedAt = (dependencies.now?.() ?? new Date()).toISOString();
    const taskDocuments = collectTaskDocuments(tasks);
    const taskDocumentIds = new Set(taskDocuments.map((document) => document.id));
    const previousById = new Map(previousIndex.documents.map((item) => [item.id, item]));
    const candidates = new Map<string, KnowledgeDocumentItem>();
    let examinedDocumentCount = 0;
    let skippedTaskDocumentCount = 0;

    for (const source of taskDocuments) {
        const queue = [{ filePath: source.filePath, documentPath: source.documentPath }];
        const visitedParents = new Set<string>();
        while (queue.length > 0) {
            const parent = queue.shift();
            if (!parent || visitedParents.has(parent.filePath)) {
                continue;
            }
            visitedParents.add(parent.filePath);
            const children = await dependencies.listChildDocuments(source.notebookId, parent.filePath);
            examinedDocumentCount += children.length;
            for (const child of children) {
                if (taskDocumentIds.has(child.id)) {
                    skippedTaskDocumentCount += 1;
                    continue;
                }
                const documentPath = joinDocumentPath(parent.documentPath, child.title);
                const previous = previousById.get(child.id);
                candidates.set(child.id, {
                    id: child.id,
                    notebookId: source.notebookId,
                    title: child.title,
                    filePath: child.path,
                    documentPath,
                    sourceDocumentId: source.id,
                    sourceDocumentTitle: source.title,
                    sourceDocumentPath: source.documentPath,
                    createdAt: child.createdAt ?? previous?.createdAt ?? scannedAt,
                    updatedAt: child.updatedAt ?? child.createdAt ?? previous?.updatedAt ?? scannedAt,
                    available: true,
                });
                if (child.subFileCount > 0) {
                    queue.push({ filePath: child.path, documentPath });
                }
            }
        }
    }

    const nextById = new Map<string, KnowledgeDocumentItem>();
    const newCandidates: KnowledgeDocumentItem[] = [];
    let existingDocumentCount = 0;
    for (const candidate of candidates.values()) {
        const previous = previousById.get(candidate.id);
        if (previous) {
            existingDocumentCount += 1;
            nextById.set(candidate.id, {
                ...candidate,
                ...(previous.review ? { review: previous.review } : {}),
            });
        } else {
            newCandidates.push(candidate);
        }
    }

    let addedDocumentCount = 0;
    let failedDocumentCount = 0;
    await runWithConcurrency(newCandidates, ATTRIBUTE_WRITE_CONCURRENCY, async (candidate) => {
        try {
            await dependencies.setBlockAttributes(candidate.id, {
                [KNOWLEDGE_DOCUMENT_ATTRIBUTE]: "true",
            });
            const attributes = await dependencies.getBlockAttributes(candidate.id);
            if (attributes[KNOWLEDGE_DOCUMENT_ATTRIBUTE] !== "true") {
                throw new Error(`Knowledge marker verification failed for ${candidate.id}`);
            }
            nextById.set(candidate.id, candidate);
            addedDocumentCount += 1;
        } catch {
            failedDocumentCount += 1;
        }
    });

    let unavailableDocumentCount = 0;
    for (const previous of previousIndex.documents) {
        if (candidates.has(previous.id)) {
            continue;
        }
        unavailableDocumentCount += 1;
        nextById.set(previous.id, {
            ...previous,
            available: false,
            missingSince: previous.missingSince ?? scannedAt,
        });
    }

    const documents = Array.from(nextById.values()).sort(compareKnowledgeDocuments);
    return {
        index: {
            version: KNOWLEDGE_INDEX_VERSION,
            lastScannedAt: scannedAt,
            documents,
        },
        report: {
            taskDocumentCount: taskDocuments.length,
            examinedDocumentCount,
            addedDocumentCount,
            existingDocumentCount,
            unavailableDocumentCount,
            failedDocumentCount,
            skippedTaskDocumentCount,
        },
    };
}

function collectTaskDocuments(tasks: readonly TaskCenterItem[]): TaskDocument[] {
    const documents = new Map<string, TaskDocument>();
    for (const task of tasks) {
        if (
            documents.has(task.rootId)
            || !task.notebookId
            || task.documentFilePath.trim() === ""
        ) {
            continue;
        }
        documents.set(task.rootId, {
            id: task.rootId,
            notebookId: task.notebookId,
            title: task.documentTitle,
            filePath: task.documentFilePath,
            documentPath: task.documentPath,
        });
    }
    return Array.from(documents.values());
}

function joinDocumentPath(parent: string, title: string): string {
    const normalizedParent = parent.endsWith("/") ? parent.slice(0, -1) : parent;
    return `${normalizedParent}/${title}`;
}

function compareKnowledgeDocuments(
    left: KnowledgeDocumentItem,
    right: KnowledgeDocumentItem,
): number {
    if (left.available !== right.available) {
        return left.available ? -1 : 1;
    }
    const updated = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    return updated || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

async function runWithConcurrency<T>(
    items: readonly T[],
    concurrency: number,
    operation: (item: T) => Promise<void>,
): Promise<void> {
    let nextIndex = 0;
    const workers = Array.from(
        { length: Math.min(concurrency, items.length) },
        async () => {
            while (nextIndex < items.length) {
                const item = items[nextIndex++];
                if (item !== undefined) {
                    await operation(item);
                }
            }
        },
    );
    await Promise.all(workers);
}
