import { describe, expect, it } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { aggregateTaskCenterRows } from "./task-center-data";

const BLOCK_ID = "20260713120000-abcdefg";
const ROOT_ID = "20260713110000-hijklmn";

function rowsFor(
    blockId = BLOCK_ID,
    overrides: Partial<Record<(typeof TASK_BLOCK_ATTRIBUTES)[keyof typeof TASK_BLOCK_ATTRIBUTES], string>> = {},
): Record<string, unknown>[] {
    const attributes = {
        [TASK_BLOCK_ATTRIBUTES.card]: "true",
        [TASK_BLOCK_ATTRIBUTES.version]: "1",
        [TASK_BLOCK_ATTRIBUTES.title]: "DS9 Adaptor",
        [TASK_BLOCK_ATTRIBUTES.url]: "https://dida365.com/webapp/#p/project/tasks/task",
        [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
        [TASK_BLOCK_ATTRIBUTES.createdAt]: "2026-07-12T08:30:00.000Z",
        [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-07-13T06:30:00.000Z",
        ...overrides,
    };
    return [{
        block_id: blockId,
        root_id: ROOT_ID,
        notebook_id: "20260713100000-opqrstu",
        document_title: "Photozpy",
        document_path: "/科研项目/Photozpy",
        ...attributes,
    }];
}

describe("aggregateTaskCenterRows", () => {
    it("aggregates the seven attributes into a task center item", () => {
        const result = aggregateTaskCenterRows(rowsFor());

        expect(result.invalidBlocks).toEqual([]);
        expect(result.incompleteBlocks).toEqual([]);
        expect(result.items).toEqual([expect.objectContaining({
            blockId: BLOCK_ID,
            rootId: ROOT_ID,
            documentTitle: "Photozpy",
            documentPath: "/科研项目/Photozpy",
            title: "DS9 Adaptor",
            status: "in-progress",
        })]);
    });

    it("groups multiple tasks and ignores duplicate SQL rows", () => {
        const secondId = "20260713120001-vwxyz12";
        const firstRows = rowsFor();
        const result = aggregateTaskCenterRows([
            ...firstRows,
            firstRows[0],
            ...rowsFor(secondId, { [TASK_BLOCK_ATTRIBUTES.title]: "Another task" }),
        ]);

        expect(result.items).toHaveLength(2);
        expect(new Set(result.items.map((item) => item.blockId)).size).toBe(2);
    });

    it("ignores rows whose task marker is not true", () => {
        const result = aggregateTaskCenterRows(rowsFor(BLOCK_ID, {
            [TASK_BLOCK_ATTRIBUTES.card]: "false",
        }));
        expect(result).toEqual({ items: [], invalidBlocks: [], incompleteBlocks: [] });
    });

    it.each([
        [TASK_BLOCK_ATTRIBUTES.version, "2", "unsupported-version"],
        [TASK_BLOCK_ATTRIBUTES.title, "", "missing-title"],
        [TASK_BLOCK_ATTRIBUTES.url, "https://example.com/task", "invalid-url"],
        [TASK_BLOCK_ATTRIBUTES.status, "unknown", "invalid-status"],
        [TASK_BLOCK_ATTRIBUTES.createdAt, "not-a-time", "invalid-created-at"],
        [TASK_BLOCK_ATTRIBUTES.updatedAt, "not-a-time", "invalid-updated-at"],
    ] as const)("skips invalid %s attributes", (attribute, value, reason) => {
        const result = aggregateTaskCenterRows(rowsFor(BLOCK_ID, { [attribute]: value }));
        expect(result.items).toEqual([]);
        expect(result.invalidBlocks).toEqual([{ blockId: BLOCK_ID, reason }]);
    });

    it("classifies a task with one missing required attribute as incomplete", () => {
        const row = rowsFor()[0];
        delete row[TASK_BLOCK_ATTRIBUTES.url];
        const result = aggregateTaskCenterRows([row]);
        expect(result.invalidBlocks).toEqual([]);
        expect(result.incompleteBlocks).toEqual([{
            blockId: BLOCK_ID,
            missingAttributes: [TASK_BLOCK_ATTRIBUTES.url],
        }]);
    });

    it("counts one incomplete block when several required attributes are missing", () => {
        const missing = new Set<string>([
            TASK_BLOCK_ATTRIBUTES.title,
            TASK_BLOCK_ATTRIBUTES.status,
            TASK_BLOCK_ATTRIBUTES.updatedAt,
        ]);
        const row = rowsFor()[0];
        for (const attribute of missing) {
            delete row[attribute];
        }
        const result = aggregateTaskCenterRows([row]);

        expect(result.items).toEqual([]);
        expect(result.invalidBlocks).toEqual([]);
        expect(result.incompleteBlocks).toEqual([{
            blockId: BLOCK_ID,
            missingAttributes: expect.arrayContaining(Array.from(missing)),
        }]);
    });

    it("skips invalid block and root IDs", () => {
        const invalidBlock = aggregateTaskCenterRows(rowsFor("bad-id"));
        const invalidRootRows = rowsFor().map((row) => ({ ...row, root_id: "bad-root" }));
        const invalidRoot = aggregateTaskCenterRows(invalidRootRows);

        expect(invalidBlock.invalidBlocks[0]?.reason).toBe("invalid-block-id");
        expect(invalidRoot.invalidBlocks[0]?.reason).toBe("invalid-root-id");
    });

    it("uses a path segment when source document metadata is missing", () => {
        const rows = rowsFor().map((row) => ({ ...row, document_title: null }));
        const result = aggregateTaskCenterRows(rows);
        expect(result.items[0]?.documentTitle).toBe("Photozpy");
    });

    it("keeps valid tasks when another task is invalid and counts the invalid block once", () => {
        const invalidId = "20260713120001-vwxyz12";
        const result = aggregateTaskCenterRows([
            ...rowsFor(),
            ...rowsFor(invalidId, { [TASK_BLOCK_ATTRIBUTES.status]: "invalid" }),
        ]);

        expect(result.items.map((item) => item.blockId)).toEqual([BLOCK_ID]);
        expect(result.invalidBlocks).toEqual([{ blockId: invalidId, reason: "invalid-status" }]);
        expect(result.incompleteBlocks).toEqual([]);
    });

    it("keeps valid tasks when another task is incomplete", () => {
        const incompleteId = "20260713120001-vwxyz12";
        const result = aggregateTaskCenterRows([
            ...rowsFor(),
            ...rowsFor(incompleteId).map((row) => {
                delete row[TASK_BLOCK_ATTRIBUTES.title];
                return row;
            }),
        ]);

        expect(result.items.map((task) => task.blockId)).toEqual([BLOCK_ID]);
        expect(result.invalidBlocks).toEqual([]);
        expect(result.incompleteBlocks).toHaveLength(1);
        expect(result.incompleteBlocks[0]?.blockId).toBe(incompleteId);
    });
});
