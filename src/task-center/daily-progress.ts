import { TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
import { getLocalDate } from "../domain/local-date";

export { getLocalDate, readLocalDate } from "../domain/local-date";

export type DailyProgressApi = {
    setBlockAttributes(blockId: string, attributes: Record<string, string>): Promise<void>;
};

export function isProgressedToday(
    lastProgressedDate: string | undefined,
    today = getLocalDate(),
): boolean {
    return lastProgressedDate === today;
}

export async function saveDailyProgress(
    api: DailyProgressApi,
    blockId: string,
    date: string | undefined,
): Promise<void> {
    await api.setBlockAttributes(blockId, {
        [TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate]: date ?? "",
    });
}

export function millisecondsUntilNextLocalDay(date = new Date()): number {
    const nextDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
        0,
        0,
        0,
        50,
    );
    return Math.max(1, nextDay.getTime() - date.getTime());
}
