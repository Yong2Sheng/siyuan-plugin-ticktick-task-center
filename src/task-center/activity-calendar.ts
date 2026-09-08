import { TASK_STATUS_CONFIG } from "../domain/status";
import { includeLegacyProgressDate, type ProgressLog } from "../domain/progress-log";
import type { TaskCenterItem } from "./task-center-data";

export type ActivityDayCounts = {
    planned: number;
    actual: number;
};

export type ActivityHeatLevel = 0 | 1 | 2 | 3 | 4;

export function getActivityHeatLevel(actual: number): ActivityHeatLevel {
    if (!Number.isFinite(actual) || actual <= 0) return 0;
    if (actual === 1) return 1;
    if (actual === 2) return 2;
    if (actual <= 4) return 3;
    return 4;
}

export function countTaskCenterActivityByDate(
    items: readonly TaskCenterItem[],
    today: string,
): ReadonlyMap<string, ActivityDayCounts> {
    const counts = new Map<string, ActivityDayCounts>();
    for (const item of items) {
        for (const entry of item.focusPlan?.entries ?? []) {
            if (entry.date > today && TASK_STATUS_CONFIG[item.status].terminal) {
                continue;
            }
            increment(counts, entry.date, "planned");
        }
        const progressLog = includeLegacyProgressDate(
            item.progressLog ?? EMPTY_LOG,
            item.lastProgressedDate,
        );
        for (const date of progressLog.dates) {
            increment(counts, date, "actual");
        }
    }
    return counts;
}

const EMPTY_LOG: ProgressLog = { version: 1, dates: [] };

function increment(
    counts: Map<string, ActivityDayCounts>,
    date: string,
    field: keyof ActivityDayCounts,
): void {
    const current = counts.get(date) ?? { planned: 0, actual: 0 };
    counts.set(date, { ...current, [field]: current[field] + 1 });
}
