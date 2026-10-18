import { isTickTickTaskStatus } from "../domain/status";
import {
    TASK_BLOCK_ATTRIBUTES,
    TASK_BLOCK_OPTIONAL_ATTRIBUTES,
    TASK_DATA_VERSION,
    type PersistedTickTickTaskData,
} from "../domain/task";
import { isAllowedTaskTarget } from "../domain/task-target";
import { readLocalDate } from "../domain/local-date";
import { isTickTickTaskWorkMode } from "../domain/work-mode";
import { parseTaskPriorityAttribute } from "../domain/priority";

export type TaskBlockParseFailure =
    | "not-task-card"
    | "unsupported-version"
    | "missing-title"
    | "invalid-url"
    | "invalid-status"
    | "invalid-work-mode"
    | "invalid-priority"
    | "invalid-deadline"
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

    // 目标链接可选：属性缺失或为空都表示「还没有链接」；
    // 但存在且非法时仍然判无效，不静默接受脏数据。
    const rawUrl = attributes[TASK_BLOCK_ATTRIBUTES.url];
    if (rawUrl !== undefined && rawUrl !== "") {
        if (typeof rawUrl !== "string" || !isAllowedTaskTarget(rawUrl)) {
            return { valid: false, reason: "invalid-url" };
        }
    }
    const url = typeof rawUrl === "string" ? rawUrl : "";

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

    const rawDeadline = attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.deadline];
    const deadline = rawDeadline === undefined || rawDeadline === ""
        ? undefined
        : readLocalDate(rawDeadline);
    if (rawDeadline !== undefined && rawDeadline !== "" && deadline === undefined) {
        return { valid: false, reason: "invalid-deadline" };
    }

    const rawWorkMode = attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.workMode];
    const workMode = rawWorkMode === undefined || rawWorkMode === ""
        ? undefined
        : rawWorkMode;
    if (workMode !== undefined && !isTickTickTaskWorkMode(workMode)) {
        return { valid: false, reason: "invalid-work-mode" };
    }

    // 权重：缺失或空字符串表示「未设置」（等同正常档）；非法值不静默降级，
    // 与其他属性一样走「属性无效」路径。
    const parsedPriority = parseTaskPriorityAttribute(
        attributes[TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority],
    );
    if (!parsedPriority.valid) {
        return { valid: false, reason: "invalid-priority" };
    }
    const priority = parsedPriority.priority;

    return {
        valid: true,
        data: {
            version: TASK_DATA_VERSION,
            title: title.trim(),
            url,
            status,
            ...(workMode ? { workMode } : {}),
            ...(priority ? { priority } : {}),
            ...(deadline ? { deadline } : {}),
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
