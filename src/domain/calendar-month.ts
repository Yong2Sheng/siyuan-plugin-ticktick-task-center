import { readLocalDate } from "./local-date";

export type CalendarMonth = {
    year: number;
    month: number;
};

export function calendarMonthFromDate(date: string): CalendarMonth | undefined {
    const valid = readLocalDate(date);
    if (!valid) {
        return undefined;
    }
    return { year: Number(valid.slice(0, 4)), month: Number(valid.slice(5, 7)) };
}

export function shiftCalendarMonth(
    calendarMonth: CalendarMonth,
    offset: number,
): CalendarMonth | undefined {
    if (!isValidMonth(calendarMonth) || !Number.isInteger(offset)) {
        return undefined;
    }
    const shifted = new Date(calendarMonth.year, calendarMonth.month - 1 + offset, 1, 12);
    return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
}

export function getCalendarMonthCells(calendarMonth: CalendarMonth): Array<string | undefined> {
    if (!isValidMonth(calendarMonth)) {
        return [];
    }
    const first = new Date(calendarMonth.year, calendarMonth.month - 1, 1, 12);
    const leading = (first.getDay() + 6) % 7;
    const dayCount = new Date(calendarMonth.year, calendarMonth.month, 0, 12).getDate();
    const cells: Array<string | undefined> = Array.from({ length: leading });
    for (let day = 1; day <= dayCount; day += 1) {
        cells.push(formatDate(calendarMonth.year, calendarMonth.month, day));
    }
    while (cells.length % 7 !== 0) {
        cells.push(undefined);
    }
    return cells;
}

export function formatCalendarMonthKey(calendarMonth: CalendarMonth): string | undefined {
    if (!isValidMonth(calendarMonth)) {
        return undefined;
    }
    return `${String(calendarMonth.year).padStart(4, "0")}-${String(calendarMonth.month).padStart(2, "0")}`;
}

function formatDate(year: number, month: number, day: number): string {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidMonth(value: CalendarMonth): boolean {
    return Number.isInteger(value.year)
        && value.year >= 1
        && value.year <= 9999
        && Number.isInteger(value.month)
        && value.month >= 1
        && value.month <= 12;
}
