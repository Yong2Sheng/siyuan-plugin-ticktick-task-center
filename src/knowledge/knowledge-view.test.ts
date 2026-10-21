// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import { KnowledgeCenterController } from "./knowledge-controller";
import type { KnowledgeDocumentItem, KnowledgeIndex } from "./knowledge-index";
import { KnowledgeCenterView } from "./knowledge-view";

const labels: Record<string, string> = {
    "knowledgeCenter.summaryAll": "All knowledge",
    "knowledgeCenter.summaryUnorganized": "Not organized",
    "knowledgeCenter.summaryOrganized": "Organized",
    "knowledgeCenter.summaryUpdated": "Updated",
    "knowledgeCenter.summaryUnavailable": "Unavailable",
    "knowledgeCenter.filterLabel": "Filter",
    "knowledgeCenter.filterAll": "All",
    "knowledgeCenter.filterUnorganized": "Not organized",
    "knowledgeCenter.filterOrganized": "Organized",
    "knowledgeCenter.filterUpdated": "Updated after organizing",
    "knowledgeCenter.filterUpdatedTitle": "Based on the last scan",
    "knowledgeCenter.initialize": "Initialize",
    "knowledgeCenter.scanNew": "Scan",
    "knowledgeCenter.scanning": "Scanning",
    "knowledgeCenter.searchPlaceholder": "Search knowledge",
    "knowledgeCenter.lastScanned": "Last scanned",
    "knowledgeCenter.scanReport": "${tasks} tasks; ${examined} checked; ${added} added; ${existing} existing; ${unavailable} unavailable; ${failed} failed",
    "knowledgeCenter.loading": "Loading knowledge",
    "knowledgeCenter.loadFailed": "Load failed",
    "knowledgeCenter.scanFailed": "Scan failed",
    "knowledgeCenter.saveFailed": "Save failed",
    "knowledgeCenter.cacheFailed": "Cache failed",
    "knowledgeCenter.emptyInitial": "Not initialized",
    "knowledgeCenter.emptyScanned": "Nothing found",
    "knowledgeCenter.emptySearch": "No matches",
    "knowledgeCenter.emptyUnorganized": "Everything is organized",
    "knowledgeCenter.emptyUnorganizedWithUpdates": "Nothing left. ${count} updated.",
    "knowledgeCenter.emptyOrganized": "Nothing organized",
    "knowledgeCenter.emptyUpdated": "No updates",
    "knowledgeCenter.badgeUnorganized": "Not organized",
    "knowledgeCenter.badgeOrganized": "Organized",
    "knowledgeCenter.unavailableBadge": "Unavailable",
    "knowledgeCenter.sourceTask": "Source task",
    "knowledgeCenter.organizedOn": "Organized on",
    "knowledgeCenter.updatedAfterOrganizing": "Updated after organizing",
    "knowledgeCenter.openDocument": "Open knowledge",
    "knowledgeCenter.openSource": "Open source",
    "knowledgeCenter.markOrganized": "Mark as organized",
    "knowledgeCenter.unmarkOrganized": "Undo organized mark",
    "knowledgeCenter.refreshOrganized": "Mark re-organized",
    "knowledgeCenter.toastMarked": "Marked as organized",
    "knowledgeCenter.toastUnmarked": "Organized mark removed",
    "knowledgeCenter.toastRefreshed": "Organizing time refreshed",
    "taskCenterView.updated": "Updated",
};
const translate: Translate = (key) => labels[key] ?? key;

const NOW = new Date("2026-09-02T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();

function makeDocument(
    id: string,
    overrides: Partial<KnowledgeDocumentItem> = {},
): KnowledgeDocumentItem {
    return {
        id,
        notebookId: "20260901070000-hijklmn",
        title: `Note ${id}`,
        filePath: `/task/${id}.sy`,
        documentPath: `/Research task/${id}`,
        sourceDocumentId: "20260901080000-opqrstu",
        sourceDocumentTitle: "Research task",
        sourceDocumentPath: "/Research task",
        createdAt: "2026-09-01T09:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
        available: true,
        ...overrides,
    };
}

const UNORGANIZED = makeDocument("unorganized", { title: "Spectral fitting notes" });
const UPDATED = makeDocument("updated", {
    title: "Updated notes",
    organizedAt: "2026-09-01T09:30:00.000Z",
    updatedAt: "2026-09-01T10:30:00.000Z",
});
const ORGANIZED = makeDocument("organized", {
    title: "Organized notes",
    organizedAt: "2026-09-01T11:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
});
const UNAVAILABLE = makeDocument("unavailable", {
    title: "Moved notes",
    available: false,
    missingSince: "2026-09-02T10:00:00.000Z",
});

function index(documents: KnowledgeDocumentItem[] = []): KnowledgeIndex {
    return {
        version: 1,
        lastScannedAt: "2026-09-02T12:00:00.000Z",
        documents,
    };
}

function summaryTexts(target: HTMLElement): string[] {
    return Array.from(
        target.querySelectorAll(".ticktick-task-center__knowledge-summary-item"),
        (element) => element.textContent ?? "",
    );
}

async function createView(initialIndex: KnowledgeIndex) {
    const target = document.createElement("div");
    document.body.append(target);
    const nextIndex = index([UNORGANIZED, UNAVAILABLE]);
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
    const writeOrganizedMark = vi.fn().mockResolvedValue(undefined);
    const clearOrganizedMark = vi.fn().mockResolvedValue(undefined);
    const controller = new KnowledgeCenterController({
        loadIndex: vi.fn().mockResolvedValue(initialIndex),
        saveIndex,
        loadTasks,
        scan,
        writeOrganizedMark,
        clearOrganizedMark,
        now: () => NOW,
    });
    const onOpenDocument = vi.fn().mockResolvedValue(undefined);
    const onOpenSource = vi.fn().mockResolvedValue(undefined);
    const onNotify = vi.fn();
    const view = new KnowledgeCenterView(target, {
        controller,
        translate,
        locale: "en-US",
        onOpenDocument,
        onOpenSource,
        onNotify,
    });
    await controller.start();
    return {
        target,
        controller,
        view,
        loadTasks,
        scan,
        saveIndex,
        writeOrganizedMark,
        clearOrganizedMark,
        onNotify,
        onOpenDocument,
        onOpenSource,
    };
}

function clickFilter(target: HTMLElement, label: string): void {
    const button = Array.from(
        target.querySelectorAll<HTMLButtonElement>(".ticktick-task-center__filter"),
    ).find((candidate) => candidate.textContent === label);
    if (!button) {
        throw new Error(`Missing filter ${label}`);
    }
    button.click();
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

    it("scans only after clicking, saves, reports, and renders the result", async () => {
        const harness = await createView({ version: 1, documents: [] });
        harness.target.querySelector<HTMLButtonElement>(".ticktick-task-center__knowledge-scan")?.click();

        await vi.waitFor(() => expect(harness.saveIndex).toHaveBeenCalledOnce());

        expect(harness.loadTasks).toHaveBeenCalledOnce();
        expect(harness.scan).toHaveBeenCalledOnce();
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-report")?.textContent)
            .toBe("1 tasks; 2 checked; 1 added; 1 existing; 1 unavailable; 0 failed");
        expect(summaryTexts(harness.target)).toEqual([
            "All knowledge 2",
            "Not organized 1",
            "Organized 0",
            "Unavailable 1",
        ]);

        clickFilter(harness.target, "All");
        expect(harness.target.querySelectorAll(".ticktick-task-center__knowledge-item"))
            .toHaveLength(2);
        expect(harness.target.querySelector<HTMLButtonElement>(
            ".ticktick-task-center__knowledge-item--unavailable .ticktick-task-center__knowledge-open",
        )?.disabled).toBe(true);
    });

    it("searches locally and opens the knowledge or source document", async () => {
        const harness = await createView(index([UNORGANIZED]));
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

        expect(harness.onOpenDocument).toHaveBeenCalledWith(UNORGANIZED.id);
        expect(harness.onOpenSource).toHaveBeenCalledWith(UNORGANIZED.sourceDocumentId);
    });

    it("defaults to unorganized and exposes the updated sub-view", async () => {
        const harness = await createView(index([UNORGANIZED, UPDATED, ORGANIZED]));

        expect(summaryTexts(harness.target)).toEqual([
            "All knowledge 3",
            "Not organized 1",
            "Organized 2",
            "Updated 1",
        ]);
        expect(harness.target.querySelectorAll(".ticktick-task-center__knowledge-item"))
            .toHaveLength(1);

        clickFilter(harness.target, "Organized");
        expect(Array.from(
            harness.target.querySelectorAll(".ticktick-task-center__knowledge-title"),
            (element) => element.textContent,
        )).toEqual(["Updated notes", "Organized notes"]);

        clickFilter(harness.target, "Updated after organizing");
        expect(harness.target.querySelectorAll(".ticktick-task-center__knowledge-item"))
            .toHaveLength(1);
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-badge")?.textContent)
            .toBe("Organized");
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-organized-updated")
            ?.textContent).toBe(" · Updated after organizing");
    });

    it("marks an unorganized document and moves it out of the unorganized view", async () => {
        const harness = await createView(index([UNORGANIZED]));

        harness.target.querySelector<HTMLButtonElement>(".ticktick-task-center__knowledge-mark")?.click();

        await vi.waitFor(() => expect(harness.onNotify).toHaveBeenCalledWith(
            "knowledgeCenter.toastMarked",
        ));
        expect(harness.writeOrganizedMark).toHaveBeenCalledWith(UNORGANIZED.id, NOW_ISO);
        expect(harness.controller.getState().items[0]?.organizedAt).toBe(NOW_ISO);
        expect(harness.target.querySelectorAll(".ticktick-task-center__knowledge-item"))
            .toHaveLength(0);
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-empty")?.textContent)
            .toBe("Everything is organized");
    });

    it("refreshes an updated document through 完成补整理", async () => {
        const harness = await createView(index([UPDATED]));
        clickFilter(harness.target, "Updated after organizing");

        harness.target.querySelector<HTMLButtonElement>(".ticktick-task-center__knowledge-mark")?.click();

        await vi.waitFor(() => expect(harness.onNotify).toHaveBeenCalledWith(
            "knowledgeCenter.toastRefreshed",
        ));
        expect(harness.writeOrganizedMark).toHaveBeenCalledWith(UPDATED.id, NOW_ISO);
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-empty")?.textContent)
            .toBe("No updates");
    });

    it("clears a mark and returns the document to the unorganized view", async () => {
        const harness = await createView(index([ORGANIZED]));
        clickFilter(harness.target, "Organized");

        harness.target.querySelector<HTMLButtonElement>(
            ".ticktick-task-center__knowledge-unmark",
        )?.click();

        await vi.waitFor(() => expect(harness.onNotify).toHaveBeenCalledWith(
            "knowledgeCenter.toastUnmarked",
        ));
        expect(harness.clearOrganizedMark).toHaveBeenCalledWith(ORGANIZED.id);
        expect(harness.controller.getState().items[0]?.organizedAt).toBeUndefined();
        expect(harness.target.querySelector(".ticktick-task-center__knowledge-empty")?.textContent)
            .toBe("Nothing organized");
    });

    it("keeps the item and shows a retryable error when the write fails", async () => {
        const harness = await createView(index([UNORGANIZED]));
        harness.writeOrganizedMark.mockRejectedValueOnce(new Error("write failed"));

        harness.target.querySelector<HTMLButtonElement>(".ticktick-task-center__knowledge-mark")?.click();

        await vi.waitFor(() => expect(
            harness.target.querySelector(".ticktick-task-center__knowledge-error")?.textContent,
        ).toBe("Save failed"));
        expect(harness.onNotify).not.toHaveBeenCalled();
        expect(harness.target.querySelectorAll(".ticktick-task-center__knowledge-item"))
            .toHaveLength(1);
    });

    it("points at updated documents when the unorganized queue is empty", async () => {
        const harness = await createView(index([UPDATED]));

        expect(harness.target.querySelector(".ticktick-task-center__knowledge-empty")?.textContent)
            .toBe("Nothing left. 1 updated.");
    });
});
