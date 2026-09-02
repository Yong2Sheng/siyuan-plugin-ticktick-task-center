import { describe, expect, it } from "vitest";

import {
    KNOWLEDGE_INDEX_VERSION,
    createEmptyKnowledgeIndex,
    parseKnowledgeIndex,
} from "./knowledge-index";

const ITEM = {
    id: "20260901090000-abcdefg",
    notebookId: "20260901080000-hijklmn",
    title: "Knowledge note",
    filePath: "/20260901090000-abcdefg.sy",
    documentPath: "/Task/Knowledge note",
    sourceDocumentId: "20260901070000-opqrstu",
    sourceDocumentTitle: "Task",
    sourceDocumentPath: "/Task",
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    available: true,
};

describe("knowledge index", () => {
    it("returns an empty index for missing or unsupported cache data", () => {
        expect(parseKnowledgeIndex(null)).toEqual(createEmptyKnowledgeIndex());
        expect(parseKnowledgeIndex({ version: 2, documents: [ITEM] }))
            .toEqual(createEmptyKnowledgeIndex());
    });

    it("normalizes valid data and drops malformed or duplicate records", () => {
        const review = {
            rating: "partially-mastered",
            reviewCount: 2,
            intervalDays: 12,
            lastReviewedAt: "2026-09-01T11:00:00Z",
            nextReviewAt: "2026-09-13T11:00:00Z",
            needsRelearning: false,
        };
        const result = parseKnowledgeIndex({
            version: KNOWLEDGE_INDEX_VERSION,
            lastScannedAt: "2026-09-01T12:00:00Z",
            documents: [
                ITEM,
                { ...ITEM, title: "Newest cached title", review },
                { ...ITEM, id: "bad" },
            ],
        });

        expect(result.lastScannedAt).toBe("2026-09-01T12:00:00.000Z");
        expect(result.documents).toHaveLength(1);
        expect(result.documents[0]?.title).toBe("Newest cached title");
        expect(result.documents[0]?.review).toEqual({
            ...review,
            lastReviewedAt: "2026-09-01T11:00:00.000Z",
            nextReviewAt: "2026-09-13T11:00:00.000Z",
        });
    });
});
