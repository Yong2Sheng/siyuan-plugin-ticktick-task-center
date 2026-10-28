import { describe, expect, it, vi } from "vitest";

import {
    buildSubprojectSql,
    loadSubprojects,
    parseSubprojectRows,
} from "./subprojects";

describe("subproject query", () => {
    it("filters by the parent attribute and only reads the fields the card needs", () => {
        const sql = buildSubprojectSql("20260712120000-abcdefg");

        expect(sql).toContain("parent.name = 'custom-ticktick-parent'");
        expect(sql).toContain("parent.value = '20260712120000-abcdefg'");
        expect(sql).toContain("'custom-ticktick-title'");
        expect(sql).toContain("'custom-ticktick-status'");
        expect(sql).toContain("'custom-ticktick-deadline'");
        expect(sql).toContain("GROUP BY task.id");
    });

    it("does not query when the parent block id is not a SiYuan id", async () => {
        const query = vi.fn();

        await expect(loadSubprojects("not-an-id", query)).resolves.toEqual([]);
        expect(query).not.toHaveBeenCalled();
    });

    it("queries with the validated parent id", async () => {
        const query = vi.fn().mockResolvedValue([]);

        await loadSubprojects("20260712120000-abcdefg", query);

        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toContain("parent.value = '20260712120000-abcdefg'");
    });
});

describe("parseSubprojectRows", () => {
    const row = (overrides: Record<string, unknown> = {}) => ({
        block_id: "20260712130000-bcdefgh",
        root_id: "20260712100000-rootdoc",
        document_path: "/Projects/Unbinned TS Map",
        document_title: "Unbinned TS Map - Restart",
        title: "Get Expectation Density",
        status: "in-progress",
        deadline: "2026-11-06",
        ...overrides,
    });

    it("maps valid rows to summaries", () => {
        expect(parseSubprojectRows([row()])).toEqual([{
            blockId: "20260712130000-bcdefgh",
            title: "Get Expectation Density",
            status: "in-progress",
            deadline: "2026-11-06",
            documentTitle: "Unbinned TS Map - Restart",
            documentPath: "/Projects/Unbinned TS Map",
        }]);
    });

    it("skips rows with an invalid block id, status or empty title", () => {
        expect(parseSubprojectRows([
            row({ block_id: "bad" }),
            row({ status: "unknown" }),
            row({ title: "   " }),
            row({ block_id: "20260712130001-cdefghi", title: "Keep me" }),
        ]).map((item) => item.title)).toEqual(["Keep me"]);
    });

    it("drops an invalid deadline but keeps the task", () => {
        const [item] = parseSubprojectRows([row({ deadline: "2026-13-40" })]);

        expect(item).toBeDefined();
        expect(item.deadline).toBeUndefined();
    });

    it("keeps one row per block even when the SQL returns duplicates", () => {
        expect(parseSubprojectRows([row(), row({ title: "Duplicate" })])).toHaveLength(1);
    });

    it("tolerates missing optional columns", () => {
        const [item] = parseSubprojectRows([{
            block_id: "20260712130000-bcdefgh",
            title: "No document info",
            status: "todo",
        }]);

        expect(item.documentTitle).toBe("");
        expect(item.documentPath).toBe("");
        expect(item.deadline).toBeUndefined();
    });
});
