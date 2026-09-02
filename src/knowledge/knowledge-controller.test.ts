import { describe, expect, it, vi } from "vitest";

import type { KnowledgeIndex } from "./knowledge-index";
import { KnowledgeCenterController } from "./knowledge-controller";

const NOW = new Date("2026-09-02T12:00:00.000Z");

const DOCUMENT = {
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

const INDEX: KnowledgeIndex = {
    version: 1,
    lastScannedAt: "2026-09-01T12:00:00.000Z",
    documents: [],
};

describe("KnowledgeCenterController", () => {
    it("loads cache on start without scanning", async () => {
        const loadIndex = vi.fn().mockResolvedValue(INDEX);
        const scan = vi.fn();
        const controller = new KnowledgeCenterController({
            loadIndex,
            saveIndex: vi.fn(),
            loadTasks: vi.fn(),
            scan,
        });

        await controller.start();

        expect(loadIndex).toHaveBeenCalledOnce();
        expect(scan).not.toHaveBeenCalled();
        expect(controller.getState().lastScannedAt).toBe(INDEX.lastScannedAt);
    });

    it("scans only on request and saves before publishing the new index", async () => {
        const nextIndex = { ...INDEX, lastScannedAt: "2026-09-02T12:00:00.000Z" };
        const saveIndex = vi.fn().mockResolvedValue(undefined);
        const loadTasks = vi.fn().mockResolvedValue([{ blockId: "task" }]);
        const scan = vi.fn().mockResolvedValue({
            index: nextIndex,
            report: {
                taskDocumentCount: 1,
                examinedDocumentCount: 2,
                addedDocumentCount: 2,
                existingDocumentCount: 0,
                unavailableDocumentCount: 0,
                failedDocumentCount: 0,
                skippedTaskDocumentCount: 0,
            },
        });
        const controller = new KnowledgeCenterController({
            loadIndex: vi.fn().mockResolvedValue(INDEX),
            saveIndex,
            loadTasks,
            scan,
        });
        await controller.start();

        await controller.scan();

        expect(loadTasks).toHaveBeenCalledOnce();
        expect(scan).toHaveBeenCalledOnce();
        expect(saveIndex).toHaveBeenCalledWith(nextIndex);
        expect(controller.getState()).toMatchObject({
            lastScannedAt: nextIndex.lastScannedAt,
            scanning: false,
            scanError: false,
        });
    });

    it("keeps the previous cache and exposes a scan error", async () => {
        const onError = vi.fn();
        const controller = new KnowledgeCenterController({
            loadIndex: vi.fn().mockResolvedValue(INDEX),
            saveIndex: vi.fn(),
            loadTasks: vi.fn().mockRejectedValue(new Error("task refresh failed")),
            scan: vi.fn(),
            onError,
        });
        await controller.start();

        await controller.scan();

        expect(controller.getState().lastScannedAt).toBe(INDEX.lastScannedAt);
        expect(controller.getState().scanError).toBe(true);
        expect(onError).toHaveBeenCalledOnce();
    });

    it("starts a due review, persists feedback, and completes the session", async () => {
        const reviewIndex: KnowledgeIndex = { ...INDEX, documents: [DOCUMENT] };
        const saveIndex = vi.fn().mockResolvedValue(undefined);
        const controller = new KnowledgeCenterController({
            loadIndex: vi.fn().mockResolvedValue(reviewIndex),
            saveIndex,
            loadTasks: vi.fn(),
            scan: vi.fn(),
            now: () => NOW,
            random: () => 0,
        });
        await controller.start();

        controller.startReview("due");
        expect(controller.getState()).toMatchObject({
            reviewSession: "active",
            reviewMode: "due",
            reviewItem: DOCUMENT,
        });

        await controller.submitReview("remembered-not-understood");

        expect(saveIndex).toHaveBeenCalledOnce();
        expect(controller.getState()).toMatchObject({
            reviewSession: "complete",
            reviewSaving: false,
            reviewError: false,
        });
        expect(controller.getState().items[0]?.review).toMatchObject({
            rating: "remembered-not-understood",
            reviewCount: 1,
            intervalDays: 1,
            needsRelearning: true,
        });
    });

    it("keeps the current review active when saving feedback fails", async () => {
        const onError = vi.fn();
        const controller = new KnowledgeCenterController({
            loadIndex: vi.fn().mockResolvedValue({ ...INDEX, documents: [DOCUMENT] }),
            saveIndex: vi.fn().mockRejectedValue(new Error("save failed")),
            loadTasks: vi.fn(),
            scan: vi.fn(),
            now: () => NOW,
            onError,
        });
        await controller.start();
        controller.startReview("random");

        await controller.submitReview("mastered");

        expect(controller.getState()).toMatchObject({
            reviewSession: "active",
            reviewItem: DOCUMENT,
            reviewSaving: false,
            reviewError: true,
        });
        expect(controller.getState().items[0]?.review).toBeUndefined();
        expect(onError).toHaveBeenCalledOnce();
    });
});
