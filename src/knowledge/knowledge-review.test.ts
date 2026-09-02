import { describe, expect, it } from "vitest";

import type { KnowledgeDocumentItem } from "./knowledge-index";
import {
    countKnowledgeReviews,
    parseKnowledgeReview,
    scheduleKnowledgeReview,
    selectKnowledgeReviewItem,
} from "./knowledge-review";

const REVIEWED_AT = new Date("2026-09-02T12:00:00.000Z");

const ITEM: KnowledgeDocumentItem = {
    id: "20260901100000-abcdefg",
    notebookId: "20260901070000-hijklmn",
    title: "Knowledge note",
    filePath: "/task/knowledge.sy",
    documentPath: "/Task/Knowledge note",
    sourceDocumentId: "20260901080000-opqrstu",
    sourceDocumentTitle: "Task",
    sourceDocumentPath: "/Task",
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    available: true,
};

describe("knowledge review scheduling", () => {
    it("uses the five initial intervals and marks comprehension failures for relearning", () => {
        expect(scheduleKnowledgeReview(undefined, "no-impression", REVIEWED_AT).intervalDays).toBe(1);
        expect(scheduleKnowledgeReview(undefined, "familiar", REVIEWED_AT).intervalDays).toBe(3);
        expect(scheduleKnowledgeReview(undefined, "partially-mastered", REVIEWED_AT).intervalDays)
            .toBe(7);
        expect(scheduleKnowledgeReview(undefined, "mastered", REVIEWED_AT).intervalDays).toBe(30);

        const notUnderstood = scheduleKnowledgeReview(
            undefined,
            "remembered-not-understood",
            REVIEWED_AT,
        );
        expect(notUnderstood).toMatchObject({
            intervalDays: 1,
            needsRelearning: true,
            reviewCount: 1,
            nextReviewAt: "2026-09-03T12:00:00.000Z",
        });
    });

    it("grows strong review intervals and resets weak feedback", () => {
        const mastered = scheduleKnowledgeReview(undefined, "mastered", REVIEWED_AT);
        expect(scheduleKnowledgeReview(mastered, "mastered", REVIEWED_AT).intervalDays).toBe(75);
        expect(scheduleKnowledgeReview(mastered, "partially-mastered", REVIEWED_AT).intervalDays)
            .toBe(15);
        expect(scheduleKnowledgeReview(mastered, "familiar", REVIEWED_AT).intervalDays).toBe(3);
    });

    it("selects due, random, or relearning documents and reports counts", () => {
        const future = scheduleKnowledgeReview(undefined, "mastered", REVIEWED_AT);
        const relearning = scheduleKnowledgeReview(
            undefined,
            "remembered-not-understood",
            new Date("2026-08-31T12:00:00.000Z"),
        );
        const items = [
            ITEM,
            { ...ITEM, id: "20260901110000-bcdefgh", review: future },
            { ...ITEM, id: "20260901120000-cdefghi", review: relearning },
            { ...ITEM, id: "20260901130000-defghij", available: false },
        ];

        expect(selectKnowledgeReviewItem(items, "due", REVIEWED_AT, () => 0)?.id).toBe(ITEM.id);
        expect(selectKnowledgeReviewItem(items, "random", REVIEWED_AT, () => 0.99)?.id)
            .toBe("20260901120000-cdefghi");
        expect(selectKnowledgeReviewItem(items, "relearning", REVIEWED_AT, () => 0)?.id)
            .toBe("20260901120000-cdefghi");
        expect(countKnowledgeReviews(items, REVIEWED_AT)).toEqual({
            due: 2,
            relearning: 1,
            reviewed: 2,
        });
    });

    it("normalizes valid cached progress and rejects malformed values", () => {
        const progress = scheduleKnowledgeReview(undefined, "familiar", REVIEWED_AT);
        expect(parseKnowledgeReview(progress)).toEqual(progress);
        expect(parseKnowledgeReview({ ...progress, reviewCount: 0 })).toBeUndefined();
        expect(parseKnowledgeReview({ ...progress, rating: "unknown" })).toBeUndefined();
        expect(parseKnowledgeReview({ ...progress, needsRelearning: true })).toEqual(progress);
    });
});
