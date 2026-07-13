import { isTickTickTaskStatus } from "../domain/status";
import {
    TASK_BLOCK_ATTRIBUTES,
    TASK_DATA_VERSION,
    type PersistedTickTickTaskData,
} from "../domain/task";
import { isAllowedTickTickUrl } from "../domain/validation";

export type TaskBlockParseFailure =
    | "not-task-card"
    | "unsupported-version"
    | "missing-title"
    | "invalid-url"
    | "invalid-status"
    | "invalid-created-at"
    | "invalid-updated-at";

export type TaskBlockParseResult =
    | { valid: true; data: PersistedTickTickTaskData }
    | { valid: false; reason: TaskBlockParseFailure };

export function parseTaskBlockAttributes(
    attributes: Readonly<Record<string, unknown>>,
): TaskBlockParseResult {
    if (attributes[TASK_BLOCK_ATTRIBUTES.card] !== "true") {
        return { valid: false, reason: "not-task-card" };
    }
    if (attributes[TASK_BLOCK_ATTRIBUTES.version] !== String(TASK_DATA_VERSION)) {
        return { valid: false, reason: "unsupported-version" };
    }

    const title = attributes[TASK_BLOCK_ATTRIBUTES.title];
    if (typeof title !== "string" || title.trim().length === 0) {
        return { valid: false, reason: "missing-title" };
    }

    const url = attributes[TASK_BLOCK_ATTRIBUTES.url];
    if (typeof url !== "string" || !isAllowedTickTickUrl(url)) {
        return { valid: false, reason: "invalid-url" };
    }

    const status = attributes[TASK_BLOCK_ATTRIBUTES.status];
    if (!isTickTickTaskStatus(status)) {
        return { valid: false, reason: "invalid-status" };
    }

    const createdAt = attributes[TASK_BLOCK_ATTRIBUTES.createdAt];
    if (!isIsoDateTime(createdAt)) {
        return { valid: false, reason: "invalid-created-at" };
    }

    const updatedAt = attributes[TASK_BLOCK_ATTRIBUTES.updatedAt];
    if (!isIsoDateTime(updatedAt)) {
        return { valid: false, reason: "invalid-updated-at" };
    }

    return {
        valid: true,
        data: {
            version: TASK_DATA_VERSION,
            title: title.trim(),
            url,
            status,
            createdAt,
            updatedAt,
        },
    };
}

function isIsoDateTime(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
    if (!match || Number.isNaN(Date.parse(value))) {
        return false;
    }

    const [, year, month, day, hour, minute, second, , offsetHour = "00", offsetMinute = "00"] = match;
    const parts = [year, month, day, hour, minute, second, offsetHour, offsetMinute].map(Number);
    const [yearNumber, monthNumber, dayNumber, hourNumber, minuteNumber, secondNumber, offsetHourNumber, offsetMinuteNumber] = parts;
    const calendarDate = new Date(Date.UTC(
        yearNumber,
        monthNumber - 1,
        dayNumber,
        hourNumber,
        minuteNumber,
        secondNumber,
    ));

    return calendarDate.getUTCFullYear() === yearNumber
        && calendarDate.getUTCMonth() === monthNumber - 1
        && calendarDate.getUTCDate() === dayNumber
        && calendarDate.getUTCHours() === hourNumber
        && calendarDate.getUTCMinutes() === minuteNumber
        && calendarDate.getUTCSeconds() === secondNumber
        && offsetHourNumber <= 23
        && offsetMinuteNumber <= 59;
}
