import { readLocalDate } from "./local-date";

export const FOCUS_PLAN_VERSION = 1 as const;
export const MAX_FOCUS_PLAN_ENTRIES = 512;

export type FocusPlanEntry = {
    date: string;
    plannedAt: string;
    completedOn?: string;
    order?: number;
};

export type FocusPlan = {
    version: typeof FOCUS_PLAN_VERSION;
    entries: readonly FocusPlanEntry[];
};

export type FocusPlanParseResult =
    | { valid: true; plan: FocusPlan }
    | { valid: false };

export type FocusDisposition = {
    kind: "overdue" | "carried" | "today";
    entry: FocusPlanEntry;
};

export const EMPTY_FOCUS_PLAN: FocusPlan = {
    version: FOCUS_PLAN_VERSION,
    entries: [],
};

export function parseFocusPlanAttribute(value: unknown): FocusPlanParseResult {
    if (value === undefined || value === "") {
        return { valid: true, plan: EMPTY_FOCUS_PLAN };
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
    if (!isRecord(parsed) || parsed.version !== FOCUS_PLAN_VERSION || !Array.isArray(parsed.entries)) {
        return { valid: false };
    }
    if (parsed.entries.length > MAX_FOCUS_PLAN_ENTRIES) {
        return { valid: false };
    }

    const dates = new Set<string>();
    const entries: FocusPlanEntry[] = [];
    for (const candidate of parsed.entries) {
        if (!isRecord(candidate)) {
            return { valid: false };
        }
        const date = readLocalDate(candidate.date);
        const completedOn = candidate.completedOn === undefined
            ? undefined
            : readLocalDate(candidate.completedOn);
        const order = candidate.order === undefined ? undefined : candidate.order;
        if (
            !date
            || !isIsoDateTime(candidate.plannedAt)
            || (candidate.completedOn !== undefined && !completedOn)
            || (completedOn !== undefined && completedOn < date)
            || (order !== undefined && (typeof order !== "number" || !Number.isFinite(order)))
            || dates.has(date)
        ) {
            return { valid: false };
        }
        dates.add(date);
        entries.push({
            date,
            plannedAt: candidate.plannedAt,
            ...(completedOn ? { completedOn } : {}),
            ...(typeof order === "number" ? { order } : {}),
        });
    }

    return {
        valid: true,
        plan: {
            version: FOCUS_PLAN_VERSION,
            entries: entries.sort(compareEntries),
        },
    };
}

export function serializeFocusPlan(plan: FocusPlan): string {
    if (plan.entries.length === 0) {
        return "";
    }
    return JSON.stringify({
        version: FOCUS_PLAN_VERSION,
        entries: [...plan.entries].sort(compareEntries),
    });
}

export function toggleQuickFocusDate(
    plan: FocusPlan,
    targetDate: string,
    today: string,
    deadline: string | undefined,
    plannedAt: string,
): { changed: true; plan: FocusPlan } | { changed: false; reason: "invalid-date" | "past-date" | "after-deadline" } {
    if (!readLocalDate(targetDate) || !readLocalDate(today) || !isIsoDateTime(plannedAt)) {
        return { changed: false, reason: "invalid-date" };
    }
    if (targetDate < today) {
        return { changed: false, reason: "past-date" };
    }
    const outstanding = plan.entries.filter((entry) => (
        !entry.completedOn && entry.date <= today
    ));
    if (targetDate === today && outstanding.length > 0) {
        const outstandingDates = new Set(outstanding.map((entry) => entry.date));
        return {
            changed: true,
            plan: withEntries(plan.entries.filter((entry) => !outstandingDates.has(entry.date))),
        };
    }

    return toggleFocusDate(plan, targetDate, today, deadline, plannedAt);
}

export function toggleFocusDate(
    plan: FocusPlan,
    targetDate: string,
    today: string,
    deadline: string | undefined,
    plannedAt: string,
): { changed: true; plan: FocusPlan } | { changed: false; reason: "invalid-date" | "past-date" | "after-deadline" } {
    if (!readLocalDate(targetDate) || !readLocalDate(today) || !isIsoDateTime(plannedAt)) {
        return { changed: false, reason: "invalid-date" };
    }

    const existing = plan.entries.find((entry) => entry.date === targetDate);
    if (existing) {
        return {
            changed: true,
            plan: withEntries(plan.entries.filter((entry) => entry.date !== targetDate)),
        };
    }

    if (targetDate < today) {
        return { changed: false, reason: "past-date" };
    }
    if (deadline && targetDate > deadline) {
        return { changed: false, reason: "after-deadline" };
    }

    return {
        changed: true,
        plan: withEntries([...plan.entries, { date: targetDate, plannedAt }]),
    };
}

export function setFocusEntryOrder(
    plan: FocusPlan,
    date: string,
    order: number,
): FocusPlan | undefined {
    if (!readLocalDate(date) || !Number.isFinite(order)) {
        return undefined;
    }
    let found = false;
    const entries = plan.entries.map((entry) => {
        if (entry.date !== date) {
            return entry;
        }
        found = true;
        return { ...entry, order };
    });
    return found ? withEntries(entries) : undefined;
}

export function getFocusEntryOrder(entry: FocusPlanEntry): number {
    return entry.order ?? Date.parse(entry.plannedAt);
}

export function setFocusPlanProgress(
    plan: FocusPlan,
    date: string,
    progressed: boolean,
): FocusPlan {
    if (!readLocalDate(date)) {
        return plan;
    }
    return withEntries(plan.entries.map((entry) => {
        if (progressed && !entry.completedOn && entry.date <= date) {
            return { ...entry, completedOn: date };
        }
        if (!progressed && entry.completedOn === date) {
            const reopened = { ...entry };
            delete reopened.completedOn;
            return reopened;
        }
        return entry;
    }));
}

export function getFocusDisposition(
    plan: FocusPlan | undefined,
    today: string,
    deadline?: string,
): FocusDisposition | undefined {
    if (!plan || !readLocalDate(today)) {
        return undefined;
    }
    const entry = plan.entries.find((candidate) => (
        !candidate.completedOn && candidate.date <= today
    ));
    if (!entry) {
        return undefined;
    }
    if (deadline && deadline < today) {
        return { kind: "overdue", entry };
    }
    return { kind: entry.date < today ? "carried" : "today", entry };
}

export function isQuickFocusDateSelected(
    plan: FocusPlan | undefined,
    targetDate: string,
    today: string,
): boolean {
    if (!plan) {
        return false;
    }
    if (targetDate === today && getFocusDisposition(plan, today)) {
        return true;
    }
    return plan.entries.some((entry) => entry.date === targetDate);
}

export function hasFocusDateAfterDeadline(
    plan: FocusPlan,
    deadline: string | undefined,
): boolean {
    return deadline !== undefined && plan.entries.some((entry) => entry.date > deadline);
}

function withEntries(entries: readonly FocusPlanEntry[]): FocusPlan {
    return {
        version: FOCUS_PLAN_VERSION,
        entries: [...entries].sort(compareEntries),
    };
}

function compareEntries(left: FocusPlanEntry, right: FocusPlanEntry): number {
    const date = left.date.localeCompare(right.date);
    if (date !== 0) {
        return date;
    }
    return left.plannedAt.localeCompare(right.plannedAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isIsoDateTime(value: unknown): value is string {
    return typeof value === "string"
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && Number.isFinite(Date.parse(value));
}
