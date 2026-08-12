import { getLocalDate, readLocalDate } from "./local-date";

export const DEADLINE_TRACK_SEGMENTS = 8;
export const DEADLINE_URGENCY_DAYS = 7;

export type DeadlineStateKind = "unset" | "normal" | "upcoming" | "today" | "overdue";

export type DeadlineState = {
    kind: DeadlineStateKind;
    daysRemaining?: number;
    filledSegments: number;
};

export function getDeadlineState(
    deadline: string | undefined,
    today = getLocalDate(),
): DeadlineState {
    if (!deadline || !readLocalDate(deadline) || !readLocalDate(today)) {
        return { kind: "unset", filledSegments: 0 };
    }

    const daysRemaining = calendarDayNumber(deadline) - calendarDayNumber(today);
    if (daysRemaining < 0) {
        return { kind: "overdue", daysRemaining, filledSegments: DEADLINE_TRACK_SEGMENTS };
    }
    if (daysRemaining === 0) {
        return { kind: "today", daysRemaining, filledSegments: DEADLINE_TRACK_SEGMENTS };
    }
    if (daysRemaining <= DEADLINE_URGENCY_DAYS) {
        return {
            kind: "upcoming",
            daysRemaining,
            filledSegments: DEADLINE_TRACK_SEGMENTS - daysRemaining,
        };
    }
    return { kind: "normal", daysRemaining, filledSegments: 0 };
}

export function formatDeadlineDate(
    deadline: string,
    locale?: string,
    today = getLocalDate(),
): string {
    const [year, month, day] = deadline.split("-").map(Number);
    const currentYear = Number(today.slice(0, 4));
    return new Intl.DateTimeFormat(locale, {
        ...(year === currentYear ? {} : { year: "numeric" as const }),
        month: "short",
        day: "numeric",
    }).format(new Date(year, month - 1, day, 12));
}

function calendarDayNumber(date: string): number {
    const [year, month, day] = date.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
