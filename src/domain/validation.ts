import { isTickTickTaskStatus } from "./status";
const ALLOWED_TICKTICK_HOSTS = new Set(["dida365.com", "ticktick.com"]);

export type TaskValidationError =
    | "title-required"
    | "url-required"
    | "url-invalid"
    | "status-invalid";

export type TaskDataCandidate = {
    title: unknown;
    url: unknown;
    status: unknown;
};

export function isAllowedTickTickUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && ALLOWED_TICKTICK_HOSTS.has(url.hostname);
    } catch {
        return false;
    }
}

export function validateTaskData(data: TaskDataCandidate): TaskValidationError[] {
    const errors: TaskValidationError[] = [];

    if (typeof data.title !== "string" || data.title.trim().length === 0) {
        errors.push("title-required");
    }

    if (typeof data.url !== "string" || data.url.trim().length === 0) {
        errors.push("url-required");
    } else if (!isAllowedTickTickUrl(data.url)) {
        errors.push("url-invalid");
    }

    if (!isTickTickTaskStatus(data.status)) {
        errors.push("status-invalid");
    }

    return errors;
}
