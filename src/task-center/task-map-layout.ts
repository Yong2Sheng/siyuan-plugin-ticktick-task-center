import type { TaskMapPosition } from "./task-center-view-state";
import type { TaskTree, TaskTreeNode } from "./task-tree";

/**
 * 项目图的自动布局。
 *
 * 纯函数：输入树、折叠状态、手动坐标，输出每个节点的位置和连线。
 * 交互、缩放和平移留在视图层，方便单独测试布局本身。
 */
export const TASK_MAP_WIDTHS = [252, 214, 194, 184] as const;
export const TASK_MAP_PARENT_HEIGHT = 108;
export const TASK_MAP_LEAF_HEIGHT = 86;
export const TASK_MAP_GAP_X = 76;
export const TASK_MAP_GAP_Y = 14;
export const TASK_MAP_LEFT = 48;
export const TASK_MAP_TOP = 56;

export type TaskMapNodeLayout = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    level: number;
};

export type TaskMapEdge = {
    from: string;
    to: string;
};

export type TaskMapBounds = {
    minX: number;
    minY: number;
    width: number;
    height: number;
};

export type TaskMapLayout = {
    nodes: TaskMapNodeLayout[];
    edges: TaskMapEdge[];
    nodeById: Map<string, TaskMapNodeLayout>;
    bounds?: TaskMapBounds;
};

export type TaskMapLayoutOptions = {
    collapsed: ReadonlySet<string>;
    manualPositions: ReadonlyMap<string, TaskMapPosition>;
    hideCompleted: boolean;
};

export function layoutTaskMap(
    rootId: string,
    tree: TaskTree,
    options: TaskMapLayoutOptions,
): TaskMapLayout {
    const root = tree.byId.get(rootId);
    if (!root) {
        return { nodes: [], edges: [], nodeById: new Map() };
    }

    const nodes: TaskMapNodeLayout[] = [];
    const edges: TaskMapEdge[] = [];
    const nodeById = new Map<string, TaskMapNodeLayout>();
    let cursor = TASK_MAP_TOP;

    const visibleChildren = (node: TaskTreeNode): readonly TaskTreeNode[] => {
        if (options.collapsed.has(node.item.blockId)) {
            return [];
        }
        if (!options.hideCompleted) {
            return node.children;
        }
        return node.children.filter((child) => !isSubtreeCompleted(child));
    };

    const place = (node: TaskTreeNode, level: number, x: number): TaskMapNodeLayout => {
        const width = TASK_MAP_WIDTHS[Math.min(level, TASK_MAP_WIDTHS.length - 1)];
        const height = node.children.length > 0 ? TASK_MAP_PARENT_HEIGHT : TASK_MAP_LEAF_HEIGHT;
        const children = visibleChildren(node);
        let y: number;
        if (children.length === 0) {
            y = cursor;
            cursor += height + TASK_MAP_GAP_Y;
        } else {
            const placed = children.map((child) => (
                place(child, level + 1, x + width + TASK_MAP_GAP_X)
            ));
            const first = placed[0];
            const last = placed[placed.length - 1];
            y = (first.y + last.y + last.height) / 2 - height / 2;
            for (const child of placed) {
                edges.push({ from: node.item.blockId, to: child.id });
            }
        }

        const layout: TaskMapNodeLayout = {
            id: node.item.blockId,
            x,
            y,
            width,
            height,
            level,
        };
        nodes.push(layout);
        nodeById.set(layout.id, layout);
        return layout;
    };

    place(root, 0, TASK_MAP_LEFT);
    applyManualPositions(root, nodeById, options);

    return {
        nodes,
        edges,
        nodeById,
        bounds: getTaskMapBounds(nodeById),
    };
}

function isSubtreeCompleted(node: TaskTreeNode): boolean {
    return node.item.status === "completed"
        && node.children.every((child) => isSubtreeCompleted(child));
}

/**
 * 手动坐标只移动「这个节点和它的整棵子树」：拖父节点时子节点跟着走，
 * 但已经被单独拖过的子节点保留自己的坐标，不会被父节点再次带偏。
 */
function applyManualPositions(
    root: TaskTreeNode,
    nodeById: Map<string, TaskMapNodeLayout>,
    options: TaskMapLayoutOptions,
): void {
    const walk = (node: TaskTreeNode, shift: TaskMapPosition): void => {
        const layout = nodeById.get(node.item.blockId);
        if (!layout) {
            return;
        }
        const autoX = layout.x;
        const autoY = layout.y;
        const manual = options.manualPositions.get(node.item.blockId);
        const actualX = manual ? manual.x : autoX + shift.x;
        const actualY = manual ? manual.y : autoY + shift.y;
        const childShift = manual
            ? { x: manual.x - autoX, y: manual.y - autoY }
            : { x: actualX - autoX, y: actualY - autoY };
        layout.x = actualX;
        layout.y = actualY;

        for (const child of node.children) {
            if (nodeById.has(child.item.blockId)) {
                walk(child, childShift);
            }
        }
    };
    walk(root, { x: 0, y: 0 });
}

function getTaskMapBounds(
    nodeById: ReadonlyMap<string, TaskMapNodeLayout>,
): TaskMapBounds | undefined {
    if (nodeById.size === 0) {
        return undefined;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodeById.values()) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    }
    return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export type TaskMapFit = {
    zoom: number;
    panX: number;
    panY: number;
};

/**
 * 视野适配。窄屏时传入更高的 minZoom，宁可让内容超出去由用户平移，
 * 也不要把整棵树压到看不清；超出时从左上角（带内边距）开始。
 */
export function fitTaskMapView(
    bounds: TaskMapBounds | undefined,
    viewportWidth: number,
    viewportHeight: number,
    options: { padding?: number; minZoom?: number; maxZoom?: number } = {},
): TaskMapFit | undefined {
    if (!bounds || viewportWidth <= 0 || viewportHeight <= 0) {
        return undefined;
    }
    const padding = options.padding ?? 34;
    const minZoom = options.minZoom ?? 0.4;
    const maxZoom = options.maxZoom ?? 1.1;
    const availableWidth = Math.max(1, viewportWidth - padding * 2);
    const availableHeight = Math.max(1, viewportHeight - padding * 2);
    const zoom = Math.max(
        minZoom,
        Math.min(maxZoom, Math.min(availableWidth / bounds.width, availableHeight / bounds.height)),
    );
    const remainingWidth = Math.max(0, availableWidth - bounds.width * zoom);
    const remainingHeight = Math.max(0, availableHeight - bounds.height * zoom);
    return {
        zoom,
        panX: padding - bounds.minX * zoom + remainingWidth / 2,
        panY: padding - bounds.minY * zoom + remainingHeight / 2,
    };
}
