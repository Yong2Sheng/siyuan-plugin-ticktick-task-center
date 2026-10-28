import { describe, expect, it } from "vitest";

import type { TickTickTaskStatus } from "../domain/status";
import type { TaskCenterItem } from "./task-center-data";
import {
    buildTaskTree,
    childrenOf,
    descendantsOf,
    getTaskProgress,
    rootTaskOf,
} from "./task-tree";

function item(
    blockId: string,
    parentBlockId?: string,
    status: TickTickTaskStatus = "in-progress",
): TaskCenterItem {
    return {
        blockId,
        rootId: "20260712120000-rootdoc",
        documentTitle: "Doc",
        documentFilePath: "/Doc.sy",
        documentPath: "Doc",
        title: blockId,
        url: "",
        status,
        createdAt: "2026-07-12T08:00:00.000Z",
        updatedAt: "2026-07-12T08:00:00.000Z",
        ...(parentBlockId ? { parentBlockId } : {}),
    };
}

describe("buildTaskTree", () => {
    it("builds roots and nested children in input order", () => {
        const tree = buildTaskTree([
            item("20260712120000-aaaaaaa"),
            item("20260712120001-bbbbbbb", "20260712120000-aaaaaaa"),
            item("20260712120002-ccccccc", "20260712120001-bbbbbbb"),
            item("20260712120003-ddddddd"),
        ]);

        expect(tree.roots.map((node) => node.item.blockId)).toEqual([
            "20260712120000-aaaaaaa",
            "20260712120003-ddddddd",
        ]);
        expect(childrenOf(tree, "20260712120000-aaaaaaa").map((node) => node.item.blockId))
            .toEqual(["20260712120001-bbbbbbb"]);
        expect(childrenOf(tree, "20260712120001-bbbbbbb").map((node) => node.item.blockId))
            .toEqual(["20260712120002-ccccccc"]);
        expect(tree.orphans.size).toBe(0);
        expect(tree.cycles.size).toBe(0);
    });

    it("treats a task whose parent is missing as a root and records it as orphan", () => {
        const tree = buildTaskTree([
            item("20260712120000-aaaaaaa", "20260712120009-zzzzzzz"),
            item("20260712120001-bbbbbbb"),
        ]);

        expect(tree.roots.map((node) => node.item.blockId)).toEqual([
            "20260712120000-aaaaaaa",
            "20260712120001-bbbbbbb",
        ]);
        expect([...tree.orphans]).toEqual(["20260712120000-aaaaaaa"]);
    });

    it("breaks a two-node cycle without losing either task", () => {
        const tree = buildTaskTree([
            item("20260712120000-aaaaaaa", "20260712120001-bbbbbbb"),
            item("20260712120001-bbbbbbb", "20260712120000-aaaaaaa"),
        ]);

        expect(tree.roots).toHaveLength(1);
        expect(tree.cycles.size).toBe(1);
        expect(tree.byId.size).toBe(2);
        expect(descendantsOf(tree, tree.roots[0].item.blockId)).toHaveLength(1);
    });

    it("treats a self-parent as a broken cycle", () => {
        const tree = buildTaskTree([item("20260712120000-aaaaaaa", "20260712120000-aaaaaaa")]);

        expect(tree.roots.map((node) => node.item.blockId)).toEqual(["20260712120000-aaaaaaa"]);
        expect([...tree.cycles]).toEqual(["20260712120000-aaaaaaa"]);
        expect(tree.byId.get("20260712120000-aaaaaaa")?.children).toEqual([]);
    });

    it("counts completed descendants across levels", () => {
        const tree = buildTaskTree([
            item("20260712120000-aaaaaaa"),
            item("20260712120001-bbbbbbb", "20260712120000-aaaaaaa", "completed"),
            item("20260712120002-ccccccc", "20260712120000-aaaaaaa", "in-progress"),
            item("20260712120003-ddddddd", "20260712120002-ccccccc", "completed"),
        ]);

        expect(getTaskProgress(tree, "20260712120000-aaaaaaa")).toEqual({
            done: 2,
            total: 3,
            percent: 67,
        });
        expect(getTaskProgress(tree, "20260712120002-ccccccc")).toEqual({
            done: 1,
            total: 1,
            percent: 100,
        });
    });

    it("finds the top-level task through the effective parent chain", () => {
        const tree = buildTaskTree([
            item("20260712120000-aaaaaaa"),
            item("20260712120001-bbbbbbb", "20260712120000-aaaaaaa"),
            item("20260712120002-ccccccc", "20260712120001-bbbbbbb"),
        ]);

        expect(rootTaskOf(tree, "20260712120002-ccccccc")?.blockId)
            .toBe("20260712120000-aaaaaaa");
        expect(rootTaskOf(tree, "20260712120000-aaaaaaa")?.blockId)
            .toBe("20260712120000-aaaaaaa");
    });

    it("returns descendants depth-first in sibling order", () => {
        const tree = buildTaskTree([
            item("20260712120000-aaaaaaa"),
            item("20260712120001-bbbbbbb", "20260712120000-aaaaaaa"),
            item("20260712120002-ccccccc", "20260712120000-aaaaaaa"),
            item("20260712120003-ddddddd", "20260712120001-bbbbbbb"),
        ]);

        expect(descendantsOf(tree, "20260712120000-aaaaaaa").map((node) => node.item.blockId))
            .toEqual([
                "20260712120001-bbbbbbb",
                "20260712120003-ddddddd",
                "20260712120002-ccccccc",
            ]);
    });
});
