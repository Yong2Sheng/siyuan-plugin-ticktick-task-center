import { isTickTickTaskStatus } from "./status";
import type { TickTickTaskStatus } from "./status";

const ALLOWED_TICKTICK_HOSTS = new Set(["dida365.com", "ticktick.com"]);

export type TaskValidationError =
    | "title-required"
    | "url-required"
    | "url-invalid"
    | "url-https-required"
    | "url-host-invalid"
    | "status-invalid";

export type TaskDataCandidate = {
    title: unknown;
    url: unknown;
    status: unknown;
};

export type NormalizedTaskData = {
    title: string;
    url: string;
    status: TickTickTaskStatus;
};

export type TaskNormalizationResult =
    | { valid: true; data: NormalizedTaskData }
    | { valid: false; errors: TaskValidationError[] };

export function isAllowedTickTickUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && ALLOWED_TICKTICK_HOSTS.has(url.hostname);
    } catch {
        return false;
    }
}

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
        try {
            const url = new URL(rawUrl);
            if (url.protocol !== "https:") {
                errors.push("url-https-required");
            } else if (!ALLOWED_TICKTICK_HOSTS.has(url.hostname)) {
                errors.push("url-host-invalid");
            } else {
                normalizedUrl = url.toString();
            }
        } catch {
            errors.push("url-invalid");
        }
    }

    if (!isTickTickTaskStatus(data.status)) {
        errors.push("status-invalid");
    }

    if (errors.length > 0 || !isTickTickTaskStatus(data.status)) {
        return { valid: false, errors };
    }

    return {
        valid: true,
        data: {
            title,
            url: normalizedUrl,
            status: data.status,
        },
    };
}
