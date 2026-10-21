import { describe, expect, it } from "vitest";

import type { KnowledgeDocumentItem } from "./knowledge-index";
import {
    countKnowledgeItems,
    filterKnowledgeItems,
    isKnowledgeUpdated,
} from "./knowledge-status";

function document(
    id: string,
    overrides: Partial<KnowledgeDocumentItem> = {},
): KnowledgeDocumentItem {
    return {
        id,
        notebookId: "20260901070000-hijklmn",
        title: `Knowledge ${id}`,
        filePath: `/${id}.sy`,
        documentPath: `/Task/${id}`,
        sourceDocumentId: "20260901080000-opqrstu",
        sourceDocumentTitle: "Task",
        sourceDocumentPath: "/Task",
        createdAt: "2026-09-01T08:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
        available: true,
        ...overrides,
    };
}

const UNORGANIZED = document("unorganized", { title: "Alpha note" });
const UPDATED = document("updated", {
    title: "Beta note",
    organizedAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T11:00:00.000Z",
});
const ORGANIZED = document("organized", {
    title: "Gamma note",
    organizedAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
});
const UNAVAILABLE = document("unavailable", {
    title: "Delta note",
    available: false,
    organizedAt: "2026-09-01T09:30:00.000Z",
});

describe("knowledge status", () => {
    it("derives the updated state from organizedAt and updatedAt", () => {
        expect(isKnowledgeUpdated(UNORGANIZED)).toBe(false);
        expect(isKnowledgeUpdated(UPDATED)).toBe(true);
        expect(isKnowledgeUpdated(ORGANIZED)).toBe(false);
        expect(isKnowledgeUpdated(UNAVAILABLE)).toBe(false);
    });

    it("counts available, unorganized, organized, and updated documents", () => {
        expect(countKnowledgeItems([UNORGANIZED, UPDATED, ORGANIZED, UNAVAILABLE]))
            .toEqual({
                all: 4,
                available: 3,
                unorganized: 1,
                organized: 2,
                updated: 1,
                unavailable: 1,
            });
    });

    it("orders 全部 by work priority and 已整理 with updates first", () => {
        expect(filterKnowledgeItems(
            [UNAVAILABLE, ORGANIZED, UPDATED, UNORGANIZED],
            "all",
            "",
        ).map((item) => item.id)).toEqual([
            "unorganized",
            "updated",
            "organized",
            "unavailable",
        ]);

        expect(filterKnowledgeItems(
            [ORGANIZED, UPDATED],
            "organized",
            "",
        ).map((item) => item.id)).toEqual(["updated", "organized"]);
    });

    it("filters updated documents and searches titles, paths, and source tasks", () => {
        const items = [UNORGANIZED, UPDATED, ORGANIZED, UNAVAILABLE];
        expect(filterKnowledgeItems(items, "updated", "").map((item) => item.id))
            .toEqual(["updated"]);
        expect(filterKnowledgeItems(items, "unorganized", "").map((item) => item.id))
            .toEqual(["unorganized"]);
        expect(filterKnowledgeItems(items, "all", "beta").map((item) => item.id))
            .toEqual(["updated"]);
        expect(filterKnowledgeItems(items, "all", "/task/organized").map((item) => item.id))
            .toEqual(["organized"]);
        expect(filterKnowledgeItems(items, "organized", "missing")).toEqual([]);
    });

    it("keeps the original list untouched", () => {
        const items = [UNAVAILABLE, ORGANIZED];
        filterKnowledgeItems(items, "all", "");
        expect(items[0]).toBe(UNAVAILABLE);
    });
});
