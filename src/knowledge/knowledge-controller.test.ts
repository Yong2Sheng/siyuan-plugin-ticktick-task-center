import { describe, expect, it, vi } from "vitest";

import type { KnowledgeDocumentItem, KnowledgeIndex } from "./knowledge-index";
import { KnowledgeCenterController } from "./knowledge-controller";

const NOW = new Date("2026-09-02T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();

const DOCUMENT: KnowledgeDocumentItem = {
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

const ORGANIZED: KnowledgeDocumentItem = {
    ...DOCUMENT,
    organizedAt: "2026-09-01T11:00:00.000Z",
};

const INDEX: KnowledgeIndex = {
    version: 1,
    lastScannedAt: "2026-09-01T12:00:00.000Z",
    documents: [],
};

const REPORT = {
    taskDocumentCount: 1,
    examinedDocumentCount: 2,
    addedDocumentCount: 2,
    existingDocumentCount: 0,
    unavailableDocumentCount: 0,
    failedDocumentCount: 0,
    skippedTaskDocumentCount: 0,
};

function createController(overrides: Partial<ConstructorParameters<typeof KnowledgeCenterController>[0]> = {}) {
    return new KnowledgeCenterController({
        loadIndex: vi.fn().mockResolvedValue(INDEX),
        saveIndex: vi.fn().mockResolvedValue(undefined),
        loadTasks: vi.fn().mockResolvedValue([]),
        scan: vi.fn().mockResolvedValue({
            index: INDEX,
            report: REPORT,
        }),
        writeOrganizedMark: vi.fn().mockResolvedValue(undefined),
        clearOrganizedMark: vi.fn().mockResolvedValue(undefined),
        now: () => NOW,
        ...overrides,
    });
}

describe("KnowledgeCenterController", () => {
    it("loads cache on start without scanning", async () => {
        const loadIndex = vi.fn().mockResolvedValue(INDEX);
        const scan = vi.fn();
        const controller = createController({ loadIndex, scan });

        await controller.start();

        expect(loadIndex).toHaveBeenCalledOnce();
        expect(scan).not.toHaveBeenCalled();
        expect(controller.getState()).toMatchObject({
            lastScannedAt: INDEX.lastScannedAt,
            filter: "unorganized",
            loading: false,
        });
    });

    it("scans only on request and saves before publishing the new index", async () => {
        const nextIndex = { ...INDEX, lastScannedAt: "2026-09-02T12:00:00.000Z" };
        const saveIndex = vi.fn().mockResolvedValue(undefined);
        const loadTasks = vi.fn().mockResolvedValue([{ blockId: "task" }]);
        const scan = vi.fn().mockResolvedValue({ index: nextIndex, report: REPORT });
        const controller = createController({ saveIndex, loadTasks, scan });
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
        const controller = createController({
            loadTasks: vi.fn().mockRejectedValue(new Error("task refresh failed")),
            onError,
        });
        await controller.start();

        await controller.scan();

        expect(controller.getState().lastScannedAt).toBe(INDEX.lastScannedAt);
        expect(controller.getState().scanError).toBe(true);
        expect(onError).toHaveBeenCalledOnce();
    });

    it("marks an available document and persists the new index", async () => {
        const writeOrganizedMark = vi.fn().mockResolvedValue(undefined);
        const saveIndex = vi.fn().mockResolvedValue(undefined);
        const controller = createController({
            loadIndex: vi.fn().mockResolvedValue({ ...INDEX, documents: [DOCUMENT] }),
            writeOrganizedMark,
            saveIndex,
        });
        await controller.start();

        await expect(controller.markOrganized(DOCUMENT.id)).resolves.toBe(true);

        expect(writeOrganizedMark).toHaveBeenCalledWith(DOCUMENT.id, NOW_ISO);
        expect(saveIndex).toHaveBeenCalledOnce();
        expect(saveIndex.mock.calls[0]?.[0]).toMatchObject({
            documents: [{ id: DOCUMENT.id, organizedAt: NOW_ISO }],
        });
        expect(controller.getState().items[0]?.organizedAt).toBe(NOW_ISO);
        expect(controller.getState().savingIds.size).toBe(0);
        expect(controller.getState().saveError).toBe(false);
        expect(controller.getState().cacheError).toBe(false);
    });

    it("clears a mark and removes the cached timestamp", async () => {
        const clearOrganizedMark = vi.fn().mockResolvedValue(undefined);
        const controller = createController({
            loadIndex: vi.fn().mockResolvedValue({ ...INDEX, documents: [ORGANIZED] }),
            clearOrganizedMark,
        });
        await controller.start();

        await expect(controller.clearOrganized(ORGANIZED.id)).resolves.toBe(true);

        expect(clearOrganizedMark).toHaveBeenCalledWith(ORGANIZED.id);
        expect(controller.getState().items[0]?.organizedAt).toBeUndefined();
        expect(controller.getState().items[0]).not.toHaveProperty("organizedAt");
    });

    it("keeps the entry unchanged when the attribute write fails", async () => {
        const onError = vi.fn();
        const controller = createController({
            loadIndex: vi.fn().mockResolvedValue({ ...INDEX, documents: [DOCUMENT] }),
            writeOrganizedMark: vi.fn().mockRejectedValue(new Error("write failed")),
            onError,
        });
        await controller.start();

        await expect(controller.markOrganized(DOCUMENT.id)).resolves.toBe(false);

        expect(onError).toHaveBeenCalledOnce();
        expect(controller.getState().items[0]?.organizedAt).toBeUndefined();
        expect(controller.getState().saveError).toBe(true);
        expect(controller.getState().savingIds.size).toBe(0);
    });

    it("keeps the attribute state and reports a cache failure", async () => {
        const onError = vi.fn();
        const controller = createController({
            loadIndex: vi.fn().mockResolvedValue({ ...INDEX, documents: [DOCUMENT] }),
            saveIndex: vi.fn().mockRejectedValue(new Error("save failed")),
            onError,
        });
        await controller.start();

        await expect(controller.markOrganized(DOCUMENT.id)).resolves.toBe(true);

        expect(controller.getState().items[0]?.organizedAt).toBe(NOW_ISO);
        expect(controller.getState().cacheError).toBe(true);
        expect(controller.getState().saveError).toBe(false);
        expect(onError).toHaveBeenCalledOnce();
    });

    it("refuses unavailable documents and scans while a write is in flight", async () => {
        let releaseWrite!: () => void;
        const writeOrganizedMark = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
            releaseWrite = resolve;
        }));
        const controller = createController({
            loadIndex: vi.fn().mockResolvedValue({
                ...INDEX,
                documents: [DOCUMENT, { ...DOCUMENT, id: "20260901110000-hijklmn", available: false }],
            }),
            writeOrganizedMark,
        });
        await controller.start();

        await expect(controller.markOrganized("20260901110000-hijklmn")).resolves.toBe(false);
        expect(writeOrganizedMark).not.toHaveBeenCalled();

        const writing = controller.markOrganized(DOCUMENT.id);
        expect(controller.getState().savingIds.has(DOCUMENT.id)).toBe(true);
        const scan = controller.scan();
        await scan;
        expect(controller.getState().scanning).toBe(false);
        releaseWrite();
        await expect(writing).resolves.toBe(true);
    });

    it("switches the active filter without touching the index", async () => {
        const saveIndex = vi.fn();
        const controller = createController({
            loadIndex: vi.fn().mockResolvedValue({ ...INDEX, documents: [DOCUMENT] }),
            saveIndex,
        });
        await controller.start();

        controller.setFilter("updated");

        expect(controller.getState().filter).toBe("updated");
        expect(saveIndex).not.toHaveBeenCalled();
    });
});
