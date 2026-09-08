import { TASK_STATUS_CONFIG } from "../domain/status";
import type { Translate } from "../i18n";
import type { TaskCenterItem } from "./task-center-data";
import { getFocusDisposition, getFocusEntryOrder } from "../domain/focus-plan";

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

export function sortTaskCenterItemsByDeadline(
    items: readonly TaskCenterItem[],
): TaskCenterItem[] {
    return [...items].sort((left, right) => {
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
