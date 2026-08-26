import { isTickTickTaskStatus } from "./status";
import type { TickTickTaskStatus } from "./status";
import { readLocalDate } from "./local-date";
import { parseTaskTarget } from "./task-target";
import { isTickTickTaskWorkMode, type TickTickTaskWorkMode } from "./work-mode";

export type TaskValidationError =
    | "title-required"
    | "url-required"
    | "url-invalid"
    | "url-protocol-unsupported"
    | "url-credentials-unsupported"
    | "url-siyuan-invalid"
    | "status-invalid"
    | "work-mode-invalid"
    | "deadline-invalid";

export type TaskDataCandidate = {
    title: unknown;
    url: unknown;
    status: unknown;
    workMode: unknown;
    deadline?: unknown;
};

export type NormalizedTaskData = {
    title: string;
    url: string;
    status: TickTickTaskStatus;
    workMode: TickTickTaskWorkMode;
    deadline?: string;
};

export type TaskNormalizationResult =
    | { valid: true; data: NormalizedTaskData }
    | { valid: false; errors: TaskValidationError[] };

export function validateTaskData(data: TaskDataCandidate): TaskValidationError[] {
    const result = normalizeTaskData(data);
    return result.valid ? [] : result.errors;
}

export function normalizeTaskData(data: TaskDataCandidate): TaskNormalizationResult {
    const errors: TaskValidationError[] = [];
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const rawUrl = typeof data.url === "string" ? data.url.trim() : "";
    let normalizedUrl = "";

    if (title.length === 0) {
        errors.push("title-required");
    }

    if (rawUrl.length === 0) {
        errors.push("url-required");
    } else {
        const target = parseTaskTarget(rawUrl);
        if (target.valid) {
            normalizedUrl = target.target.url;
        } else if (target.reason === "unsupported-protocol") {
            errors.push("url-protocol-unsupported");
        } else if (target.reason === "embedded-credentials") {
            errors.push("url-credentials-unsupported");
        } else if (target.reason === "invalid-siyuan-block") {
            errors.push("url-siyuan-invalid");
        } else {
            errors.push("url-invalid");
        }
    }

    if (!isTickTickTaskStatus(data.status)) {
        errors.push("status-invalid");
    }

    if (!isTickTickTaskWorkMode(data.workMode)) {
        errors.push("work-mode-invalid");
    }

    const rawDeadline = typeof data.deadline === "string" ? data.deadline.trim() : "";
    const deadline = rawDeadline === "" ? undefined : readLocalDate(rawDeadline);
    if (rawDeadline !== "" && deadline === undefined) {
        errors.push("deadline-invalid");
    }

    if (
        errors.length > 0
        || !isTickTickTaskStatus(data.status)
        || !isTickTickTaskWorkMode(data.workMode)
    ) {
        return { valid: false, errors };
    }

    return {
        valid: true,
        data: {
            title,
            url: normalizedUrl,
            status: data.status,
            workMode: data.workMode,
            ...(deadline ? { deadline } : {}),
        },
    };
}
