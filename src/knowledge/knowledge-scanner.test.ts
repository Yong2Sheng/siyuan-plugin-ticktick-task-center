import { describe, expect, it, vi } from "vitest";

import type { TaskCenterItem } from "../task-center/task-center-data";
import { KNOWLEDGE_DOCUMENT_ATTRIBUTE, createEmptyKnowledgeIndex } from "./knowledge-index";
import { scanKnowledgeDocuments } from "./knowledge-scanner";

const SCANNED_AT = new Date("2026-09-01T12:00:00.000Z");

function task(
    rootId: string,
    title: string,
    filePath: string,
    documentPath: string,
): TaskCenterItem {
    return {
        blockId: `${rootId.slice(0, -7)}1234567`,
        rootId,
        notebookId: "20260901070000-abcdefg",
        documentTitle: title,
        documentFilePath: filePath,
        documentPath,
        title,
        url: "https://example.com/task",
        status: "in-progress",
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T09:00:00.000Z",
    };
}

const ROOT = task(
    "20260901080000-hijklmn",
    "Research task",
    "/20260901080000-hijklmn.sy",
    "/Research task",
);
const NESTED_TASK = task(
    "20260901090000-opqrstu",
    "Nested task",
    "/20260901080000-hijklmn/20260901090000-opqrstu.sy",
    "/Research task/Nested task",
);

function child(
    id: string,
    title: string,
    path: string,
    subFileCount = 0,
) {
    return {
        id,
        title,
        path,
        subFileCount,
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T11:00:00.000Z",
    };
}

describe("scanKnowledgeDocuments", () => {
    it("marks descendants, skips nested task documents, and assigns the nearest task source", async () => {
        const ROOT_NOTE = child(
            "20260901100000-vwxyz12",
            "Root knowledge",
            "/20260901080000-hijklmn/20260901100000-vwxyz12.sy",
            1,
        );
        const DEEP_NOTE = child(
            "20260901110000-2345678",
            "Deep knowledge",
            "/20260901080000-hijklmn/20260901100000-vwxyz12/20260901110000-2345678.sy",
        );
        const NESTED_NOTE = child(
            "20260901120000-3456789",
            "Nested knowledge",
            "/20260901080000-hijklmn/20260901090000-opqrstu/20260901120000-3456789.sy",
        );
        const listChildDocuments = vi.fn(async (_notebookId: string, path: string) => {
            if (path === ROOT.documentFilePath) {
                return [ROOT_NOTE, child(
                    NESTED_TASK.rootId,
                    NESTED_TASK.documentTitle,
                    NESTED_TASK.documentFilePath,
                    1,
                )];
            }
            if (path === ROOT_NOTE.path) {
                return [DEEP_NOTE];
            }
            if (path === NESTED_TASK.documentFilePath) {
                return [NESTED_NOTE];
            }
            return [];
        });
        const setBlockAttributes = vi.fn().mockResolvedValue(undefined);
        const getBlockAttributes = vi.fn().mockResolvedValue({
            [KNOWLEDGE_DOCUMENT_ATTRIBUTE]: "true",
        });

        const result = await scanKnowledgeDocuments(
            [ROOT, { ...ROOT, blockId: "20260901080100-456789a" }, NESTED_TASK],
            createEmptyKnowledgeIndex(),
            {
                listChildDocuments,
                setBlockAttributes,
                getBlockAttributes,
                loadOrganizedMarks: vi.fn().mockResolvedValue(new Map()),
                now: () => SCANNED_AT,
            },
        );

        expect(result.index.documents.map((item) => item.title))
            .toEqual(["Deep knowledge", "Nested knowledge", "Root knowledge"]);
        expect(result.index.documents.find((item) => item.id === NESTED_NOTE.id)?.sourceDocumentId)
            .toBe(NESTED_TASK.rootId);
        expect(result.index.documents.some((item) => item.id === NESTED_TASK.rootId)).toBe(false);
        expect(result.report).toEqual({
            taskDocumentCount: 2,
            examinedDocumentCount: 4,
            addedDocumentCount: 3,
            existingDocumentCount: 0,
            unavailableDocumentCount: 0,
            failedDocumentCount: 0,
            skippedTaskDocumentCount: 1,
        });
        expect(setBlockAttributes).toHaveBeenCalledTimes(3);
        expect(setBlockAttributes).toHaveBeenCalledWith(ROOT_NOTE.id, {
            [KNOWLEDGE_DOCUMENT_ATTRIBUTE]: "true",
        });
        expect(getBlockAttributes).toHaveBeenCalledTimes(3);
    });

    it("keeps marks and unavailable records without rewriting cached documents", async () => {
        const KNOWN = child(
            "20260901130000-56789ab",
            "Known knowledge",
            "/20260901080000-hijklmn/20260901130000-56789ab.sy",
        );
        const KNOWN_ORGANIZED_AT = "2026-09-01T10:30:00.000Z";
        const MISSING = {
            id: "20260901140000-6789abc",
            notebookId: ROOT.notebookId!,
            title: "Missing knowledge",
            filePath: "/missing.sy",
            documentPath: "/Research task/Missing knowledge",
            sourceDocumentId: ROOT.rootId,
            sourceDocumentTitle: ROOT.documentTitle,
            sourceDocumentPath: ROOT.documentPath,
            createdAt: "2026-08-31T10:00:00.000Z",
            updatedAt: "2026-08-31T11:00:00.000Z",
            available: true,
            organizedAt: "2026-08-31T09:00:00.000Z",
        };
        const previous = {
            version: 1 as const,
            lastScannedAt: "2026-08-31T12:00:00.000Z",
            documents: [{
                ...MISSING,
                id: KNOWN.id,
                title: KNOWN.title,
                filePath: KNOWN.path,
                organizedAt: "2026-08-30T10:00:00.000Z",
                review: { rating: "mastered" },
            }, MISSING],
        };
        const setBlockAttributes = vi.fn();
        const getBlockAttributes = vi.fn();
        const loadOrganizedMarks = vi.fn().mockResolvedValue(
            new Map([[KNOWN.id, KNOWN_ORGANIZED_AT]]),
        );
        const knownWithoutTimestamps = {
            ...KNOWN,
            createdAt: undefined,
            updatedAt: undefined,
        };

        const result = await scanKnowledgeDocuments([ROOT], previous, {
            listChildDocuments: vi.fn().mockResolvedValue([knownWithoutTimestamps]),
            setBlockAttributes,
            getBlockAttributes,
            loadOrganizedMarks,
            now: () => SCANNED_AT,
        });

        expect(setBlockAttributes).not.toHaveBeenCalled();
        expect(getBlockAttributes).not.toHaveBeenCalled();
        expect(result.report.existingDocumentCount).toBe(1);
        expect(result.report.unavailableDocumentCount).toBe(1);
        expect(result.index.documents.find((item) => item.id === KNOWN.id)).toMatchObject({
            createdAt: MISSING.createdAt,
            updatedAt: MISSING.updatedAt,
            organizedAt: KNOWN_ORGANIZED_AT,
        });
        expect(result.index.documents.find((item) => item.id === KNOWN.id)).not.toHaveProperty("review");
        expect(result.index.documents.find((item) => item.id === MISSING.id)).toMatchObject({
            available: false,
            missingSince: SCANNED_AT.toISOString(),
            organizedAt: MISSING.organizedAt,
        });
    });

    it("drops a cached mark that is gone and restores one for a new document", async () => {
        const KNOWN = child(
            "20260901150000-789abcd",
            "Known knowledge",
            "/20260901080000-hijklmn/20260901150000-789abcd.sy",
        );
        const NEW_MARKED = child(
            "20260901160000-89abcde",
            "Restored knowledge",
            "/20260901080000-hijklmn/20260901160000-89abcde.sy",
        );
        const RESTORED_AT = "2026-09-01T09:45:00.000Z";
        const previous = {
            version: 1 as const,
            documents: [{
                id: KNOWN.id,
                notebookId: ROOT.notebookId!,
                title: KNOWN.title,
                filePath: KNOWN.path,
                documentPath: "/Research task/Known knowledge",
                sourceDocumentId: ROOT.rootId,
                sourceDocumentTitle: ROOT.documentTitle,
                sourceDocumentPath: ROOT.documentPath,
                createdAt: KNOWN.createdAt,
                updatedAt: KNOWN.updatedAt,
                available: true,
                organizedAt: "2026-08-30T10:00:00.000Z",
            }],
        };

        const result = await scanKnowledgeDocuments([ROOT], previous, {
            listChildDocuments: vi.fn().mockResolvedValue([KNOWN, NEW_MARKED]),
            setBlockAttributes: vi.fn().mockResolvedValue(undefined),
            getBlockAttributes: vi.fn().mockResolvedValue({
                [KNOWLEDGE_DOCUMENT_ATTRIBUTE]: "true",
            }),
            loadOrganizedMarks: vi.fn().mockResolvedValue(
                new Map([[NEW_MARKED.id, RESTORED_AT]]),
            ),
            now: () => SCANNED_AT,
        });

        expect(result.index.documents.find((item) => item.id === KNOWN.id)?.organizedAt)
            .toBeUndefined();
        expect(result.index.documents.find((item) => item.id === NEW_MARKED.id)?.organizedAt)
            .toBe(RESTORED_AT);
    });

    it("keeps failed writes out of the cache so a later scan can retry", async () => {
        const NOTE = child(
            "20260901170000-9abcdef",
            "Retry knowledge",
            "/20260901080000-hijklmn/20260901170000-9abcdef.sy",
        );
        const result = await scanKnowledgeDocuments([ROOT], createEmptyKnowledgeIndex(), {
            listChildDocuments: vi.fn().mockResolvedValue([NOTE]),
            setBlockAttributes: vi.fn().mockResolvedValue(undefined),
            getBlockAttributes: vi.fn().mockResolvedValue({}),
            loadOrganizedMarks: vi.fn().mockResolvedValue(new Map()),
            now: () => SCANNED_AT,
        });

        expect(result.index.documents).toEqual([]);
        expect(result.report.failedDocumentCount).toBe(1);
    });
});
