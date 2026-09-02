// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import { KnowledgeCenterController } from "./knowledge-controller";
import type { KnowledgeDocumentItem, KnowledgeIndex } from "./knowledge-index";
import { KnowledgeCenterView } from "./knowledge-view";

const labels: Record<string, string> = {
    "knowledgeCenter.summaryAll": "All knowledge",
    "knowledgeCenter.summaryAvailable": "Available",
    "knowledgeCenter.summarySources": "Sources",
    "knowledgeCenter.summaryDue": "Due",
    "knowledgeCenter.summaryRelearning": "Relearning",
    "knowledgeCenter.summaryUnavailable": "Unavailable",
    "knowledgeCenter.initialize": "Initialize",
    "knowledgeCenter.scanNew": "Scan new",
    "knowledgeCenter.scanning": "Scanning",
    "knowledgeCenter.startDueReview": "Start due review",
    "knowledgeCenter.startRandomReview": "Random review",
    "knowledgeCenter.startRelearning": "Relearn",
    "knowledgeCenter.reviewHeading": "Knowledge review",
    "knowledgeCenter.stopReview": "Stop review",
    "knowledgeCenter.openForReview": "Open for review",
    "knowledgeCenter.reviewPrompt": "Recall, check, and rate",
    "knowledgeCenter.dueReviewComplete": "Due review complete",
    "knowledgeCenter.randomReviewComplete": "Random review complete",
    "knowledgeCenter.relearningComplete": "Relearning complete",
    "knowledgeCenter.reviewSaveFailed": "Review save failed",
    "knowledgeCenter.lastReviewed": "Last reviewed",
    "knowledgeCenter.nextReview": "Next review",
    "knowledgeCenter.feedbackLabel": "Feedback",
    "knowledgeCenter.neverReviewed": "Never reviewed",
    "knowledgeCenter.relearningBadge": "Needs relearning",
    "knowledgeCenter.rating.no-impression.label": "No impression",
    "knowledgeCenter.rating.no-impression.description": "No memory",
    "knowledgeCenter.rating.familiar.label": "Familiar",
    "knowledgeCenter.rating.familiar.description": "Looks familiar",
    "knowledgeCenter.rating.remembered-not-understood.label": "Remembered, not understood",
    "knowledgeCenter.rating.remembered-not-understood.description": "Needs relearning",
    "knowledgeCenter.rating.partially-mastered.label": "Partially mastered",
    "knowledgeCenter.rating.partially-mastered.description": "Some gaps",
    "knowledgeCenter.rating.mastered.label": "Mastered",
    "knowledgeCenter.rating.mastered.description": "Can explain it",
    "knowledgeCenter.searchPlaceholder": "Search knowledge",
    "knowledgeCenter.lastScanned": "Last scanned",
    "knowledgeCenter.scanReport": "${tasks} tasks; ${examined} checked; ${added} added; ${existing} existing; ${unavailable} unavailable; ${failed} failed",
    "knowledgeCenter.loading": "Loading knowledge",
    "knowledgeCenter.loadFailed": "Load failed",
    "knowledgeCenter.scanFailed": "Scan failed",
    "knowledgeCenter.emptyInitial": "Not initialized",
    "knowledgeCenter.emptyScanned": "Nothing found",
    "knowledgeCenter.emptySearch": "No matches",
    "knowledgeCenter.badge": "Knowledge",
    "knowledgeCenter.unavailableBadge": "Unavailable",
    "knowledgeCenter.sourceTask": "Source task",
    "knowledgeCenter.openDocument": "Open knowledge",
    "knowledgeCenter.openSource": "Open source",
    "taskCenterView.updated": "Updated",
};
const translate: Translate = (key) => labels[key] ?? key;

const AVAILABLE: KnowledgeDocumentItem = {
    id: "20260901100000-abcdefg",
    notebookId: "20260901070000-hijklmn",
    title: "Spectral fitting notes",
    filePath: "/task/knowledge.sy",
    documentPath: "/Research task/Spectral fitting notes",
    sourceDocumentId: "20260901080000-opqrstu",
    sourceDocumentTitle: "Research task",
    sourceDocumentPath: "/Research task",
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    available: true,
};
const UNAVAILABLE: KnowledgeDocumentItem = {
    ...AVAILABLE,
    id: "20260901110000-vwxyz12",
    title: "Moved notes",
    filePath: "/task/moved.sy",
    documentPath: "/Research task/Moved notes",
    available: false,
    missingSince: "2026-09-02T10:00:00.000Z",
};

function index(documents: KnowledgeDocumentItem[] = []): KnowledgeIndex {
    return {
        version: 1,
        lastScannedAt: "2026-09-02T12:00:00.000Z",
        documents,
    };
}

async function createView(initialIndex: KnowledgeIndex) {
    const target = document.createElement("div");
    document.body.append(target);
    const nextIndex = index([AVAILABLE, UNAVAILABLE]);
    const loadTasks = vi.fn().mockResolvedValue([]);
    const scan = vi.fn().mockResolvedValue({
        index: nextIndex,
        report: {
            taskDocumentCount: 1,
            examinedDocumentCount: 2,
            addedDocumentCount: 1,
            existingDocumentCount: 1,
            unavailableDocumentCount: 1,
            failedDocumentCount: 0,
            skippedTaskDocumentCount: 0,
        },
    });
    const saveIndex = vi.fn().mockResolvedValue(undefined);
    const controller = new KnowledgeCenterController({
        loadIndex: vi.fn().mockResolvedValue(initialIndex),
        saveIndex,
        loadTasks,
        scan,
    });
    const onOpenDocument = vi.fn().mockResolvedValue(undefined);
    const onOpenSource = vi.fn().mockResolvedValue(undefined);
    const view = new KnowledgeCenterView(target, {
        controller,
        translate,
        locale: "en-US",
        onOpenDocument,
        onOpenSource,
    });
    await controller.start();
    return {
        target,
        controller,
        view,
        loadTasks,
        scan,
        saveIndex,
        onOpenDocument,
        onOpenSource,
    };
}

describe("KnowledgeCenterView", () => {
    beforeEach(() => document.body.replaceChildren());

    it("shows the manual first-scan state without starting a scan", async () => {
        const harness = await createView({ version: 1, documents: [] });

        expect(harness.target.querySelector(".ticktick-task-center__knowledge-empty")?.textContent)
            .toBe("Not initialized");
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-scan")?.textContent)
            .toBe("Initialize");
        expect(harness.loadTasks).not.toHaveBeenCalled();
        expect(harness.scan).not.toHaveBeenCalled();
    });

    it("scans only after clicking, saves, reports, and renders available and missing cards", async () => {
        const harness = await createView({ version: 1, documents: [] });
        harness.target.querySelector<HTMLButtonElement>(".ticktick-task-center__knowledge-scan")?.click();

        await vi.waitFor(() => expect(harness.saveIndex).toHaveBeenCalledOnce());

        expect(harness.loadTasks).toHaveBeenCalledOnce();
        expect(harness.scan).toHaveBeenCalledOnce();
        expect(harness.target.querySelectorAll(".ticktick-task-center__knowledge-item"))
            .toHaveLength(2);
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-report")?.textContent)
            .toBe("1 tasks; 2 checked; 1 added; 1 existing; 1 unavailable; 0 failed");
        expect(harness.target.querySelector<HTMLButtonElement>(
            ".ticktick-task-center__knowledge-item--unavailable .ticktick-task-center__knowledge-open",
        )?.disabled).toBe(true);
    });

    it("searches locally and opens the knowledge or source document", async () => {
        const harness = await createView(index([AVAILABLE]));
        const search = harness.target.querySelector<HTMLInputElement>(
            ".ticktick-task-center__knowledge-search",
        )!;
        search.value = "spectral";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        expect(harness.target.querySelectorAll(".ticktick-task-center__knowledge-item"))
            .toHaveLength(1);

        harness.target.querySelector<HTMLButtonElement>(
            ".ticktick-task-center__knowledge-open",
        )?.click();
        harness.target.querySelector<HTMLButtonElement>(
            ".ticktick-task-center__knowledge-open-source",
        )?.click();
        await Promise.resolve();

        expect(harness.onOpenDocument).toHaveBeenCalledWith(AVAILABLE.id);
        expect(harness.onOpenSource).toHaveBeenCalledWith(AVAILABLE.sourceDocumentId);
    });

    it("runs a review session and saves one of the five feedback levels", async () => {
        const harness = await createView(index([AVAILABLE]));

        harness.target.querySelector<HTMLButtonElement>(
            ".ticktick-task-center__knowledge-review-start--due",
        )?.click();

        expect(harness.target.querySelector(".ticktick-task-center__knowledge-review")
            ?.classList.contains("fn__none")).toBe(false);
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-review-identity h3")
            ?.textContent).toBe(AVAILABLE.title);
        expect(harness.target.querySelectorAll(".ticktick-task-center__knowledge-review-rating"))
            .toHaveLength(5);

        harness.target.querySelector<HTMLButtonElement>(
            '[data-rating="remembered-not-understood"]',
        )?.click();
        await vi.waitFor(() => expect(harness.saveIndex).toHaveBeenCalledOnce());

        expect(harness.controller.getState().items[0]?.review).toMatchObject({
            rating: "remembered-not-understood",
            needsRelearning: true,
        });
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-review-complete")
            ?.textContent).toBe("Due review complete");
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-review-state")
            ?.textContent).toContain("Needs relearning");
    });
});
