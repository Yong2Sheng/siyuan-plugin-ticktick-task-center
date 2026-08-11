import { TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";

export type DailyProgressApi = {
    setBlockAttributes(blockId: string, attributes: Record<string, string>): Promise<void>;
};

export function getLocalDate(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function readLocalDate(value: unknown): string | undefined {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return undefined;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
        ? value
        : undefined;
}

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
