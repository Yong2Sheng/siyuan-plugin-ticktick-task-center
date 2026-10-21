import type { KnowledgeDocumentItem } from "./knowledge-index";

export type KnowledgeFilter = "all" | "unorganized" | "organized" | "updated";

export type KnowledgeCounts = {
    all: number;
    available: number;
    unorganized: number;
    organized: number;
    updated: number;
    unavailable: number;
};

/**
 * 「整理后有更新」是派生状态，不单独持久化：
 * 文档在整理之后又被编辑过，就说明整理时收录的内容可能已经过时。
 */
export function isKnowledgeUpdated(item: KnowledgeDocumentItem): boolean {
    if (!item.available || !item.organizedAt) {
        return false;
    }
    const organizedAt = Date.parse(item.organizedAt);
    const updatedAt = Date.parse(item.updatedAt);
    return Number.isFinite(organizedAt)
        && Number.isFinite(updatedAt)
        && updatedAt > organizedAt;
}

export function countKnowledgeItems(
    items: readonly KnowledgeDocumentItem[],
): KnowledgeCounts {
    const available = items.filter((item) => item.available);
    return {
        all: items.length,
        available: available.length,
        unorganized: available.filter((item) => !item.organizedAt).length,
        organized: available.filter((item) => Boolean(item.organizedAt)).length,
        updated: available.filter(isKnowledgeUpdated).length,
        unavailable: items.length - available.length,
    };
}

export function filterKnowledgeItems(
    items: readonly KnowledgeDocumentItem[],
    filter: KnowledgeFilter,
    search: string,
): KnowledgeDocumentItem[] {
    const query = search.trim().toLocaleLowerCase();
    const filtered = items.filter((item) => {
        if (!matchesFilter(item, filter)) {
            return false;
        }
        return query === "" || matchesSearch(item, query);
    });
    return filtered.sort(compareKnowledgeItems);
}

function matchesFilter(item: KnowledgeDocumentItem, filter: KnowledgeFilter): boolean {
    switch (filter) {
        case "unorganized":
            return item.available && !item.organizedAt;
        case "organized":
            return item.available && Boolean(item.organizedAt);
        case "updated":
            return isKnowledgeUpdated(item);
        default:
            return true;
    }
}

function matchesSearch(item: KnowledgeDocumentItem, query: string): boolean {
    return [
        item.title,
        item.documentPath,
        item.sourceDocumentTitle,
        item.sourceDocumentPath,
    ].some((value) => value.toLocaleLowerCase().includes(query));
}

/**
 * 「全部」里按处理优先级排列：未整理 → 整理后有更新 → 已整理 → 可能失效。
 * 「已整理」视图把有更新的排在最前；「整理后有更新」按最近更新时间降序。
 */
function compareKnowledgeItems(
    left: KnowledgeDocumentItem,
    right: KnowledgeDocumentItem,
): number {
    const rank = statusRank(left) - statusRank(right);
    if (rank !== 0) {
        return rank;
    }
    const time = statusRank(left) === 2
        ? compareDescending(left.organizedAt, right.organizedAt)
        : compareDescending(left.updatedAt, right.updatedAt);
    return time !== 0
        ? time
        : left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function statusRank(item: KnowledgeDocumentItem): number {
    if (!item.available) {
        return 3;
    }
    if (!item.organizedAt) {
        return 0;
    }
    return isKnowledgeUpdated(item) ? 1 : 2;
}

function compareDescending(left: string | undefined, right: string | undefined): number {
    return parseTime(right) - parseTime(left);
}

function parseTime(value: string | undefined): number {
    const time = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(time) ? time : 0;
}
