import { TASK_STATUS_CONFIG } from "../domain/status";
import type { Translate } from "../i18n";
import type { TaskCenterItem } from "./task-center-data";
import { getFocusDisposition, getFocusEntryOrder } from "../domain/focus-plan";
import { getTaskPriorityOrder, resolveTaskPriority } from "../domain/priority";

export const TASK_CENTER_FILTERS = ["active", "closed", "all"] as const;
export type TaskCenterFilter = (typeof TASK_CENTER_FILTERS)[number];
export const DEFAULT_TASK_CENTER_FILTER: TaskCenterFilter = "active";

export type TaskCenterStatistics = {
    all: number;
    active: number;
    closed: number;
};

export function filterTaskCenterItems(
    items: readonly TaskCenterItem[],
    filter: TaskCenterFilter,
    search: string,
    translate: Translate,
): TaskCenterItem[] {
    const query = search.trim().toLocaleLowerCase();
    return sortTaskCenterItems(items.filter((item) => {
        const terminal = TASK_STATUS_CONFIG[item.status].terminal;
        if ((filter === "active" && terminal) || (filter === "closed" && !terminal)) {
            return false;
        }
        if (query === "") {
            return true;
        }
        const statusLabel = translate(TASK_STATUS_CONFIG[item.status].labelKey);
        return [item.title, item.documentTitle, item.documentPath, statusLabel]
            .some((value) => value.toLocaleLowerCase().includes(query));
    }));
}

export function sortTaskCenterItems(items: readonly TaskCenterItem[]): TaskCenterItem[] {
    return [...items].sort(compareByUpdatedTitleAndId);
}

/**
 * 「今日待推进」的排序：任务权重优先，其次截止日期越近越前。
 *
 * 权重是第一主键而非截止日期，因为很多截止日期只是自己给自己定的软日期，过期也没有
 * 真实代价；把软日期当主键会让两个月前的软截止任务一直霸占列表顶部。截止日期退为
 * 同一档位内的相对先后，硬截止日期的紧迫感仍然保留。
 */
export function sortTaskCenterItemsByDeadline(
    items: readonly TaskCenterItem[],
): TaskCenterItem[] {
    return [...items].sort((left, right) => {
        const priority = getTaskPriorityOrder(resolveTaskPriority(left.priority))
            - getTaskPriorityOrder(resolveTaskPriority(right.priority));
        if (priority !== 0) {
            return priority;
        }
        if (left.deadline && right.deadline) {
            const deadline = left.deadline.localeCompare(right.deadline);
            if (deadline !== 0) {
                return deadline;
            }
        } else if (left.deadline) {
            return -1;
        } else if (right.deadline) {
            return 1;
        }
        return compareByUpdatedTitleAndId(left, right);
    });
}

export function sortTaskCenterFocusItems(
    items: readonly TaskCenterItem[],
    today: string,
): TaskCenterItem[] {
    return [...items].sort((left, right) => {
        const leftFocus = getFocusDisposition(left.focusPlan, today, left.deadline);
        const rightFocus = getFocusDisposition(right.focusPlan, today, right.deadline);
        if (!leftFocus || !rightFocus) {
            return leftFocus ? -1 : rightFocus ? 1 : compareByUpdatedTitleAndId(left, right);
        }
        const order = getFocusEntryOrder(leftFocus.entry) - getFocusEntryOrder(rightFocus.entry);
        if (order !== 0) {
            return order;
        }
        const focusDate = leftFocus.entry.date.localeCompare(rightFocus.entry.date);
        return focusDate !== 0 ? focusDate : compareByUpdatedTitleAndId(left, right);
    });
}

function compareByUpdatedTitleAndId(left: TaskCenterItem, right: TaskCenterItem): number {
    const updated = right.updatedAt.localeCompare(left.updatedAt);
    if (updated !== 0) {
        return updated;
    }
    const title = left.title.localeCompare(right.title);
    return title !== 0 ? title : left.blockId.localeCompare(right.blockId);
}

export function countTaskCenterItems(items: readonly TaskCenterItem[]): TaskCenterStatistics {
    const active = items.filter((item) => !TASK_STATUS_CONFIG[item.status].terminal).length;
    return {
        all: items.length,
        active,
        closed: items.length - active,
    };
}
