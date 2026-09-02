import { isSiYuanId } from "../domain/siyuan-id";
import {
    parseKnowledgeReview,
    type KnowledgeReviewProgress,
} from "./knowledge-review";

export const KNOWLEDGE_INDEX_VERSION = 1 as const;
export const KNOWLEDGE_DOCUMENT_ATTRIBUTE = "custom-task-center-knowledge";
export const KNOWLEDGE_INDEX_FILE = "knowledge-index.json";

export type KnowledgeDocumentItem = {
    id: string;
    notebookId: string;
    title: string;
    filePath: string;
    documentPath: string;
    sourceDocumentId: string;
    sourceDocumentTitle: string;
    sourceDocumentPath: string;
    createdAt: string;
    updatedAt: string;
    available: boolean;
    missingSince?: string;
    review?: KnowledgeReviewProgress;
};

export type KnowledgeIndex = {
    version: typeof KNOWLEDGE_INDEX_VERSION;
    lastScannedAt?: string;
    documents: KnowledgeDocumentItem[];
};

export function createEmptyKnowledgeIndex(): KnowledgeIndex {
    return { version: KNOWLEDGE_INDEX_VERSION, documents: [] };
}

export function parseKnowledgeIndex(value: unknown): KnowledgeIndex {
    if (!isRecord(value) || value.version !== KNOWLEDGE_INDEX_VERSION) {
        return createEmptyKnowledgeIndex();
    }
    const documents = Array.isArray(value.documents)
        ? value.documents.flatMap(parseKnowledgeDocument)
        : [];
    const lastScannedAt = readIsoTime(value.lastScannedAt);
    return {
        version: KNOWLEDGE_INDEX_VERSION,
        ...(lastScannedAt ? { lastScannedAt } : {}),
        documents: deduplicateDocuments(documents),
    };
}

function parseKnowledgeDocument(value: unknown): KnowledgeDocumentItem[] {
    if (!isRecord(value)) {
        return [];
    }
    const id = readString(value.id);
    const notebookId = readString(value.notebookId);
    const sourceDocumentId = readString(value.sourceDocumentId);
    const filePath = readString(value.filePath);
    const createdAt = readIsoTime(value.createdAt);
    const updatedAt = readIsoTime(value.updatedAt);
    if (
        !isSiYuanId(id)
        || !isSiYuanId(notebookId)
        || !isSiYuanId(sourceDocumentId)
        || filePath === ""
        || !createdAt
        || !updatedAt
    ) {
        return [];
    }
    const missingSince = readIsoTime(value.missingSince);
    const review = parseKnowledgeReview(value.review);
    return [{
        id,
        notebookId,
        title: readString(value.title).trim() || id,
        filePath,
        documentPath: readString(value.documentPath),
        sourceDocumentId,
        sourceDocumentTitle: readString(value.sourceDocumentTitle).trim() || sourceDocumentId,
        sourceDocumentPath: readString(value.sourceDocumentPath),
        createdAt,
        updatedAt,
        available: value.available !== false,
        ...(missingSince ? { missingSince } : {}),
        ...(review ? { review } : {}),
    }];
}

function deduplicateDocuments(documents: readonly KnowledgeDocumentItem[]): KnowledgeDocumentItem[] {
    const unique = new Map<string, KnowledgeDocumentItem>();
    for (const document of documents) {
        unique.set(document.id, document);
    }
    return Array.from(unique.values());
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function readIsoTime(value: unknown): string | undefined {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
        return undefined;
    }
    return new Date(value).toISOString();
}
