import { describe, expect, it } from "vitest";

import type { TickTickTaskStatus } from "../domain/status";
import type { TaskCenterItem } from "./task-center-data";
import { buildTaskTree } from "./task-tree";
import {
    fitTaskMapView,
    layoutTaskMap,
    TASK_MAP_GAP_X,
    TASK_MAP_GAP_Y,
    TASK_MAP_LEAF_HEIGHT,
    TASK_MAP_LEFT,
    TASK_MAP_PARENT_HEIGHT,
    TASK_MAP_TOP,
    TASK_MAP_WIDTHS,
} from "./task-map-layout";

const ROOT = "20260713120000-aaaaaaa";
const CHILD_A = "20260713120001-bbbbbbb";
const CHILD_B = "20260713120002-ccccccc";

function item(
    blockId: string,
    parentBlockId?: string,
    status: TickTickTaskStatus = "in-progress",
): TaskCenterItem {
    return {
        blockId,
        rootId: "20260713110000-hijklmn",
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

const EMPTY_OPTIONS = {
    collapsed: new Set<string>(),
    manualPositions: new Map(),
    hideCompleted: false,
};

describe("layoutTaskMap", () => {
    it("lays out a root and children left to right, centering the root", () => {
        const tree = buildTaskTree([
            item(ROOT),
            item(CHILD_A, ROOT),
            item(CHILD_B, ROOT),
        ]);
        const layout = layoutTaskMap(ROOT, tree, EMPTY_OPTIONS);
        const root = layout.nodeById.get(ROOT);
        const childA = layout.nodeById.get(CHILD_A);
        const childB = layout.nodeById.get(CHILD_B);

        expect(root).toMatchObject({
            x: TASK_MAP_LEFT,
            width: TASK_MAP_WIDTHS[0],
            height: TASK_MAP_PARENT_HEIGHT,
            level: 0,
        });
        expect(childA).toMatchObject({
            x: TASK_MAP_LEFT + TASK_MAP_WIDTHS[0] + TASK_MAP_GAP_X,
            y: TASK_MAP_TOP,
            width: TASK_MAP_WIDTHS[1],
            height: TASK_MAP_LEAF_HEIGHT,
            level: 1,
        });
        expect(childB?.y).toBe(TASK_MAP_TOP + TASK_MAP_LEAF_HEIGHT + TASK_MAP_GAP_Y);
        expect(root?.y).toBe((childA!.y + childB!.y + TASK_MAP_LEAF_HEIGHT) / 2
            - TASK_MAP_PARENT_HEIGHT / 2);
        expect(layout.edges).toEqual([
            { from: ROOT, to: CHILD_A },
            { from: ROOT, to: CHILD_B },
        ]);
    });

    it("hides children and edges when the parent is collapsed", () => {
        const tree = buildTaskTree([
            item(ROOT),
            item(CHILD_A, ROOT),
            item(CHILD_B, ROOT),
        ]);
        const layout = layoutTaskMap(ROOT, tree, {
            ...EMPTY_OPTIONS,
            collapsed: new Set([ROOT]),
        });

        expect(layout.nodes.map((node) => node.id)).toEqual([ROOT]);
        expect(layout.edges).toEqual([]);
    });

    it("hides fully completed subtrees when requested", () => {
        const tree = buildTaskTree([
            item(ROOT),
            item(CHILD_A, ROOT, "completed"),
            item(CHILD_B, ROOT, "in-progress"),
        ]);
        const layout = layoutTaskMap(ROOT, tree, {
            ...EMPTY_OPTIONS,
            hideCompleted: true,
        });

        expect(layout.nodeById.has(CHILD_A)).toBe(false);
        expect(layout.nodeById.has(CHILD_B)).toBe(true);
        expect(layout.edges).toEqual([{ from: ROOT, to: CHILD_B }]);
    });

    it("moves a manually positioned node together with its subtree", () => {
        const grandchild = "20260713120003-ddddddd";
        const tree = buildTaskTree([
            item(ROOT),
            item(CHILD_A, ROOT),
            item(grandchild, CHILD_A),
        ]);
        const auto = layoutTaskMap(ROOT, tree, EMPTY_OPTIONS);
        const manual = layoutTaskMap(ROOT, tree, {
            ...EMPTY_OPTIONS,
            manualPositions: new Map([[ROOT, { x: 500, y: 300 }]]),
        });
        const autoChild = auto.nodeById.get(CHILD_A)!;
        const autoRoot = auto.nodeById.get(ROOT)!;
        const movedRoot = manual.nodeById.get(ROOT)!;
        const movedChild = manual.nodeById.get(CHILD_A)!;

        expect(movedRoot.x).toBe(500);
        expect(movedRoot.y).toBe(300);
        expect(movedChild.x).toBe(autoChild.x + (500 - autoRoot.x));
        expect(movedChild.y).toBe(autoChild.y + (300 - autoRoot.y));
        expect(manual.nodeById.get(grandchild)?.y)
            .toBe(auto.nodeById.get(grandchild)!.y + (300 - autoRoot.y));
    });

    it("keeps an individually dragged child exactly where it was dropped", () => {
        const tree = buildTaskTree([
            item(ROOT),
            item(CHILD_A, ROOT),
            item(CHILD_B, ROOT),
        ]);
        const layout = layoutTaskMap(ROOT, tree, {
            ...EMPTY_OPTIONS,
            manualPositions: new Map([[CHILD_A, { x: 700, y: 400 }]]),
        });

        expect(layout.nodeById.get(CHILD_A)).toMatchObject({ x: 700, y: 400 });
        expect(layout.nodeById.get(CHILD_B)?.x)
            .toBe(TASK_MAP_LEFT + TASK_MAP_WIDTHS[0] + TASK_MAP_GAP_X);
    });

    it("returns an empty layout for an unknown root", () => {
        const tree = buildTaskTree([item(ROOT)]);
        const layout = layoutTaskMap("20260713120009-zzzzzzz", tree, EMPTY_OPTIONS);

        expect(layout.nodes).toEqual([]);
        expect(layout.bounds).toBeUndefined();
    });
});

describe("fitTaskMapView", () => {
    it("fits the bounds with padding and centers the content", () => {
        const fit = fitTaskMapView(
            { minX: 48, minY: 56, width: 542, height: 186 },
            1000,
            600,
            { padding: 34 },
        );

        expect(fit).toBeDefined();
        expect(fit!.zoom).toBeCloseTo(1.1, 5);
        expect(fit!.panX).toBeCloseTo(34 - 48 * 1.1 + (932 - 542 * 1.1) / 2, 5);
        expect(fit!.panY).toBeCloseTo(34 - 56 * 1.1 + (532 - 186 * 1.1) / 2, 5);
    });

    it("honours the minimum zoom on a narrow viewport", () => {
        const fit = fitTaskMapView(
            { minX: 0, minY: 0, width: 1000, height: 1000 },
            420,
            520,
            { minZoom: 0.72 },
        );

        expect(fit?.zoom).toBe(0.72);
        expect(fit?.panX).toBe(34);
        expect(fit?.panY).toBe(34);
    });

    it("returns undefined without bounds or viewport size", () => {
        expect(fitTaskMapView(undefined, 100, 100)).toBeUndefined();
        expect(fitTaskMapView({ minX: 0, minY: 0, width: 10, height: 10 }, 0, 100))
            .toBeUndefined();
    });
});
