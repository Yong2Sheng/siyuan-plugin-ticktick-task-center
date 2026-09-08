import { readLocalDate } from "./local-date";

export const PROGRESS_LOG_VERSION = 1 as const;
export const MAX_PROGRESS_LOG_DATES = 4096;

export type ProgressLog = {
    version: typeof PROGRESS_LOG_VERSION;
    dates: readonly string[];
};

export type ProgressLogParseResult =
    | { valid: true; log: ProgressLog }
    | { valid: false };

export const EMPTY_PROGRESS_LOG: ProgressLog = {
    version: PROGRESS_LOG_VERSION,
    dates: [],
};

export function parseProgressLogAttribute(value: unknown): ProgressLogParseResult {
    if (value === undefined || value === "") {
        return { valid: true, log: EMPTY_PROGRESS_LOG };
    }
    if (typeof value !== "string") {
        return { valid: false };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return { valid: false };
    }
    if (!isRecord(parsed) || parsed.version !== PROGRESS_LOG_VERSION || !Array.isArray(parsed.dates)) {
        return { valid: false };
    }
    if (parsed.dates.length > MAX_PROGRESS_LOG_DATES) {
        return { valid: false };
    }

    const dates = new Set<string>();
    for (const candidate of parsed.dates) {
        const date = readLocalDate(candidate);
        if (!date || dates.has(date)) {
            return { valid: false };
        }
        dates.add(date);
    }
    return {
        valid: true,
        log: { version: PROGRESS_LOG_VERSION, dates: Array.from(dates).sort() },
    };
}

export function serializeProgressLog(log: ProgressLog): string {
    if (log.dates.length === 0) {
        return "";
    }
    return JSON.stringify({
        version: PROGRESS_LOG_VERSION,
        dates: [...log.dates].sort(),
    });
}

export function includeLegacyProgressDate(
    log: ProgressLog,
    lastProgressedDate: string | undefined,
): ProgressLog {
    const date = readLocalDate(lastProgressedDate);
    return date ? setProgressLogDate(log, date, true) : log;
}

export function setProgressLogDate(
    log: ProgressLog,
    date: string,
    progressed: boolean,
): ProgressLog {
    const validDate = readLocalDate(date);
    if (!validDate) {
        return log;
    }
    const dates = new Set(log.dates);
    if (progressed) {
        dates.add(validDate);
    } else {
        dates.delete(validDate);
    }
    return {
        version: PROGRESS_LOG_VERSION,
        dates: Array.from(dates).sort().slice(-MAX_PROGRESS_LOG_DATES),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
