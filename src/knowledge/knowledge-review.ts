import type { KnowledgeDocumentItem } from "./knowledge-index";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PARTIAL_INTERVAL_DAYS = 180;
const MAX_MASTERED_INTERVAL_DAYS = 730;

export const KNOWLEDGE_REVIEW_RATINGS = [
    "no-impression",
    "familiar",
    "remembered-not-understood",
    "partially-mastered",
    "mastered",
] as const;

export type KnowledgeReviewRating = typeof KNOWLEDGE_REVIEW_RATINGS[number];

export type KnowledgeReviewProgress = {
    rating: KnowledgeReviewRating;
    reviewCount: number;
    intervalDays: number;
    lastReviewedAt: string;
    nextReviewAt: string;
    needsRelearning: boolean;
};

export type KnowledgeReviewMode = "due" | "random" | "relearning";

export function scheduleKnowledgeReview(
    previous: KnowledgeReviewProgress | undefined,
    rating: KnowledgeReviewRating,
    reviewedAt: Date,
): KnowledgeReviewProgress {
    const intervalDays = calculateIntervalDays(previous, rating);
    return {
        rating,
        reviewCount: (previous?.reviewCount ?? 0) + 1,
        intervalDays,
        lastReviewedAt: reviewedAt.toISOString(),
        nextReviewAt: new Date(reviewedAt.getTime() + intervalDays * DAY_MS).toISOString(),
        needsRelearning: rating === "remembered-not-understood",
    };
}

export function isKnowledgeReviewDue(
    item: KnowledgeDocumentItem,
    now: Date,
): boolean {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    return item.available
        && (!item.review || Date.parse(item.review.nextReviewAt) <= endOfToday.getTime());
}

export function selectKnowledgeReviewItem(
    items: readonly KnowledgeDocumentItem[],
    mode: KnowledgeReviewMode,
    now: Date,
    random: () => number,
    excludedIds: ReadonlySet<string> = new Set(),
): KnowledgeDocumentItem | undefined {
    const available = items.filter((item) => item.available && !excludedIds.has(item.id));
    const candidates = mode === "due"
        ? available.filter((item) => isKnowledgeReviewDue(item, now))
        : mode === "relearning"
            ? available.filter((item) => item.review?.needsRelearning)
            : available;
    if (candidates.length === 0) {
        return undefined;
    }
    const index = Math.min(
        candidates.length - 1,
        Math.max(0, Math.floor(random() * candidates.length)),
    );
    return candidates[index];
}

export function countKnowledgeReviews(
    items: readonly KnowledgeDocumentItem[],
    now: Date,
): { due: number; relearning: number; reviewed: number } {
    let due = 0;
    let relearning = 0;
    let reviewed = 0;
    for (const item of items) {
        if (!item.available) {
            continue;
        }
        if (item.review) {
            reviewed += 1;
            if (item.review.needsRelearning) {
                relearning += 1;
            }
        }
        if (isKnowledgeReviewDue(item, now)) {
            due += 1;
        }
    }
    return { due, relearning, reviewed };
}

export function parseKnowledgeReview(value: unknown): KnowledgeReviewProgress | undefined {
    if (!isRecord(value) || !isKnowledgeReviewRating(value.rating)) {
        return undefined;
    }
    const reviewCount = readPositiveInteger(value.reviewCount);
    const intervalDays = readPositiveInteger(value.intervalDays);
    const lastReviewedAt = readIsoTime(value.lastReviewedAt);
    const nextReviewAt = readIsoTime(value.nextReviewAt);
    if (!reviewCount || !intervalDays || !lastReviewedAt || !nextReviewAt) {
        return undefined;
    }
    return {
        rating: value.rating,
        reviewCount,
        intervalDays,
        lastReviewedAt,
        nextReviewAt,
        needsRelearning: value.rating === "remembered-not-understood",
    };
}

function calculateIntervalDays(
    previous: KnowledgeReviewProgress | undefined,
    rating: KnowledgeReviewRating,
): number {
    switch (rating) {
        case "no-impression":
        case "remembered-not-understood":
            return 1;
        case "familiar":
            return 3;
        case "partially-mastered":
            if (!previous || previous.needsRelearning) {
                return 7;
            }
            if (previous.rating === "partially-mastered") {
                return Math.min(
                    MAX_PARTIAL_INTERVAL_DAYS,
                    Math.max(7, Math.ceil(previous.intervalDays * 1.6)),
                );
            }
            if (previous.rating === "mastered") {
                return Math.max(7, Math.ceil(previous.intervalDays * 0.5));
            }
            return 7;
        case "mastered":
            return previous && !previous.needsRelearning
                ? Math.min(
                    MAX_MASTERED_INTERVAL_DAYS,
                    Math.max(30, Math.ceil(previous.intervalDays * 2.5)),
                )
                : 30;
    }
}

function isKnowledgeReviewRating(value: unknown): value is KnowledgeReviewRating {
    return typeof value === "string"
        && (KNOWLEDGE_REVIEW_RATINGS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveInteger(value: unknown): number | undefined {
    return typeof value === "number" && Number.isInteger(value) && value > 0
        ? value
        : undefined;
}

function readIsoTime(value: unknown): string | undefined {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
        return undefined;
    }
    return new Date(value).toISOString();
}
