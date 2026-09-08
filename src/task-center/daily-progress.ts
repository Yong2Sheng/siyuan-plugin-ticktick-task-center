import { TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
import { getLocalDate } from "../domain/local-date";
import {
    parseFocusPlanAttribute,
    serializeFocusPlan,
    setFocusPlanProgress,
    type FocusPlan,
} from "../domain/focus-plan";
import {
    includeLegacyProgressDate,
    parseProgressLogAttribute,
    serializeProgressLog,
    setProgressLogDate,
    type ProgressLog,
} from "../domain/progress-log";

export { getLocalDate, readLocalDate } from "../domain/local-date";

export type DailyProgressApi = {
    loadAttributes(blockId: string): Promise<Record<string, unknown>>;
    setBlockAttributes(blockId: string, attributes: Record<string, string>): Promise<void>;
};

export type DailyProgressSaveResult = {
    focusPlan?: FocusPlan;
    progressLog?: ProgressLog;
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
    today = getLocalDate(),
): Promise<DailyProgressSaveResult> {
    const currentAttributes = await api.loadAttributes(blockId);
    const parsedPlan = parseFocusPlanAttribute(
        currentAttributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan],
    );
    const focusPlan = parsedPlan.valid && parsedPlan.plan.entries.length > 0
        ? setFocusPlanProgress(parsedPlan.plan, today, date !== undefined)
        : undefined;
    const parsedProgressLog = parseProgressLogAttribute(
        currentAttributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog],
    );
    if (!parsedProgressLog.valid) {
        throw new Error(`Invalid progress log for TickTick task ${blockId}`);
    }
    const progressLog = setProgressLogDate(
        includeLegacyProgressDate(
            parsedProgressLog.log,
            typeof currentAttributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate] === "string"
                ? currentAttributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate] as string
                : undefined,
        ),
        date ?? today,
        date !== undefined,
    );
    const nextAttributes: Record<string, string> = {
        [TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate]: date ?? "",
        [TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog]: serializeProgressLog(progressLog),
        ...(focusPlan ? {
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan]: serializeFocusPlan(focusPlan),
        } : {}),
    };
    await api.setBlockAttributes(blockId, nextAttributes);

    const verified = await api.loadAttributes(blockId);
    const verifiedProgress = verified[TASK_BLOCK_OPTIONAL_ATTRIBUTES.lastProgressedDate];
    if (
        (date !== undefined && verifiedProgress !== date)
        || (date === undefined && verifiedProgress !== undefined && verifiedProgress !== "")
    ) {
        throw new Error(`Daily progress verification failed for TickTick task ${blockId}`);
    }
    const verifiedProgressLog = parseProgressLogAttribute(
        verified[TASK_BLOCK_OPTIONAL_ATTRIBUTES.progressLog],
    );
    if (
        !verifiedProgressLog.valid
        || serializeProgressLog(verifiedProgressLog.log) !== serializeProgressLog(progressLog)
    ) {
        throw new Error(`Progress log verification failed for TickTick task ${blockId}`);
    }
    if (focusPlan) {
        const verifiedPlan = parseFocusPlanAttribute(
            verified[TASK_BLOCK_OPTIONAL_ATTRIBUTES.focusPlan],
        );
        if (
            !verifiedPlan.valid
            || serializeFocusPlan(verifiedPlan.plan) !== serializeFocusPlan(focusPlan)
        ) {
            throw new Error(`Focus plan verification failed for TickTick task ${blockId}`);
        }
        return { focusPlan: verifiedPlan.plan, progressLog: verifiedProgressLog.log };
    }
    return { progressLog: verifiedProgressLog.log };
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
