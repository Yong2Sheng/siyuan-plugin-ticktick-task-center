import { isTickTickTaskStatus } from "./status";
import type { TickTickTaskStatus } from "./status";
import { readLocalDate } from "./local-date";
import { parseTaskTarget } from "./task-target";
import { isTickTickTaskWorkMode, type TickTickTaskWorkMode } from "./work-mode";
import { parseTaskPriorityAttribute, type TickTickTaskPriority } from "./priority";

export type TaskValidationError =
    | "title-required"
    | "url-invalid"
    | "url-protocol-unsupported"
    | "url-credentials-unsupported"
    | "url-siyuan-invalid"
    | "status-invalid"
    | "work-mode-invalid"
    | "priority-invalid"
    | "deadline-invalid";

export type TaskDataCandidate = {
    title: unknown;
    url: unknown;
    status: unknown;
    workMode: unknown;
    /** 空字符串表示「未设置权重」，等同正常档。 */
    priority?: unknown;
    deadline?: unknown;
};

export type NormalizedTaskData = {
    title: string;
    /** 空字符串表示「还没有目标链接」。链接是可选字段，不是必填。 */
    url: string;
    status: TickTickTaskStatus;
    workMode: TickTickTaskWorkMode;
    /** undefined 表示未设置权重，不是「无权重」这一档。 */
    priority?: TickTickTaskPriority;
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

    // 目标链接是可选字段：留空表示「还没有链接」，不报错；
    // 但一旦填了就必须是允许的目标，非法值仍然拒绝，不静默丢弃。
    if (rawUrl.length > 0) {
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

    // 权重可选：空字符串或缺失表示「未设置」；填了就必须是合法档位。
    const parsedPriority = parseTaskPriorityAttribute(data.priority);
    if (!parsedPriority.valid) {
        errors.push("priority-invalid");
    }
    const priority = parsedPriority.valid ? parsedPriority.priority : undefined;

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
            ...(priority ? { priority } : {}),
            ...(deadline ? { deadline } : {}),
        },
    };
}
