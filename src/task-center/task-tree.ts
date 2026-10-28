import type { TaskCenterItem } from "./task-center-data";

/**
 * 任务层级树。
 *
 * 父子关系来自任务块的 `custom-ticktick-parent` 属性，但这里只信任「当前任务中心
 * 能读到的任务」：父块不存在时按顶层处理（孤儿），父级链成环时断开环上的一个节点。
 * 这两种情况都只影响视图，不会写回任务块——数据坏了应该让人看见，而不是静默改掉。
 */
export type TaskTreeNode = {
    item: TaskCenterItem;
    children: TaskTreeNode[];
};

export type TaskTree = {
    roots: TaskTreeNode[];
    byId: Map<string, TaskTreeNode>;
    /** 父级 id 指向的任务不存在（被删除、取消任务标记或不在当前空间）。 */
    orphans: Set<string>;
    /** 为了断开环而被当作顶层处理的节点。 */
    cycles: Set<string>;
    /** 实际参与构树的父级；环和孤儿在这里是 undefined。 */
    parentOf: Map<string, string | undefined>;
};

export type TaskProgress = {
    done: number;
    total: number;
    percent: number;
};

export function buildTaskTree(items: readonly TaskCenterItem[]): TaskTree {
    const nodes = new Map<string, TaskTreeNode>();
    for (const item of items) {
        nodes.set(item.blockId, { item, children: [] });
    }

    const parentOf = new Map<string, string | undefined>();
    const orphans = new Set<string>();
    for (const item of items) {
        const parentId = item.parentBlockId;
        if (!parentId) {
            parentOf.set(item.blockId, undefined);
            continue;
        }
        if (!nodes.has(parentId)) {
            orphans.add(item.blockId);
            parentOf.set(item.blockId, undefined);
            continue;
        }
        parentOf.set(item.blockId, parentId);
    }

    // 断环：沿父级链走，第一次遇到重复节点时把这个节点当作顶层。
    // 只断开一个节点就足以让整条链变成树，且结果与遍历顺序无关。
    const cycles = new Set<string>();
    for (const item of items) {
        let current: string | undefined = item.blockId;
        const seen = new Set<string>();
        while (current !== undefined) {
            if (seen.has(current)) {
                parentOf.set(current, undefined);
                cycles.add(current);
                break;
            }
            seen.add(current);
            current = parentOf.get(current);
        }
    }

    const roots: TaskTreeNode[] = [];
    for (const item of items) {
        const node = nodes.get(item.blockId);
        if (!node) {
            continue;
        }
        const parentId = parentOf.get(item.blockId);
        if (parentId === undefined) {
            roots.push(node);
            continue;
        }
        nodes.get(parentId)?.children.push(node);
    }

    return { roots, byId: nodes, orphans, cycles, parentOf };
}

export function childrenOf(tree: TaskTree, blockId: string): readonly TaskTreeNode[] {
    return tree.byId.get(blockId)?.children ?? [];
}

export function hasChildren(tree: TaskTree, blockId: string): boolean {
    return childrenOf(tree, blockId).length > 0;
}

/** 所有层级的后代，深度优先、保持兄弟顺序。 */
export function descendantsOf(tree: TaskTree, blockId: string): TaskTreeNode[] {
    const result: TaskTreeNode[] = [];
    const stack = [...childrenOf(tree, blockId)].reverse();
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) {
            continue;
        }
        result.push(node);
        stack.push(...[...node.children].reverse());
    }
    return result;
}

export function getTaskProgress(tree: TaskTree, blockId: string): TaskProgress {
    const descendants = descendantsOf(tree, blockId);
    const done = descendants.filter((node) => node.item.status === "completed").length;
    return {
        done,
        total: descendants.length,
        percent: descendants.length === 0 ? 0 : Math.round((done / descendants.length) * 100),
    };
}

/** 沿实际父级找到最顶层的任务；父级链已断，不会死循环。 */
export function rootTaskOf(tree: TaskTree, blockId: string): TaskCenterItem | undefined {
    let current = tree.byId.get(blockId)?.item;
    const seen = new Set<string>();
    while (current && !seen.has(current.blockId)) {
        seen.add(current.blockId);
        const parentId = tree.parentOf.get(current.blockId);
        if (!parentId) {
            return current;
        }
        const parent = tree.byId.get(parentId)?.item;
        if (!parent) {
            return current;
        }
        current = parent;
    }
    return current;
}
