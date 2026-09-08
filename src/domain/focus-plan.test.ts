import { describe, expect, it } from "vitest";

import {
    EMPTY_FOCUS_PLAN,
    getFocusDisposition,
    hasFocusDateAfterDeadline,
    isQuickFocusDateSelected,
    parseFocusPlanAttribute,
    serializeFocusPlan,
    setFocusEntryOrder,
    setFocusPlanProgress,
    toggleFocusDate,
    toggleQuickFocusDate,
    type FocusPlan,
} from "./focus-plan";

const MONDAY = "2026-09-07";
const TUESDAY = "2026-09-08";
const WEDNESDAY = "2026-09-09";
const THURSDAY = "2026-09-10";
const PLANNED_AT = "2026-09-06T20:00:00.000Z";

function plan(...dates: string[]): FocusPlan {
    return {
        version: 1,
        entries: dates.map((date, index) => ({
            date,
            plannedAt: `2026-09-06T20:00:0${index}.000Z`,
        })),
    };
}

describe("focus plan", () => {
    it("round-trips a versioned plan and treats a missing attribute as empty", () => {
        const original = plan(MONDAY, TUESDAY);
        expect(parseFocusPlanAttribute(serializeFocusPlan(original)))
            .toEqual({ valid: true, plan: original });
        expect(parseFocusPlanAttribute(undefined)).toEqual({ valid: true, plan: EMPTY_FOCUS_PLAN });
    });

    it.each([
        ["not json"],
        [JSON.stringify({ version: 2, entries: [] })],
        [JSON.stringify({ version: 1, entries: [{ date: "2026-02-31", plannedAt: PLANNED_AT }] })],
        [JSON.stringify({ version: 1, entries: [{ date: MONDAY, plannedAt: "invalid" }] })],
        [JSON.stringify({ version: 1, entries: [
            { date: MONDAY, plannedAt: PLANNED_AT },
            { date: MONDAY, plannedAt: PLANNED_AT },
        ] })],
        [JSON.stringify({ version: 1, entries: [
            { date: TUESDAY, plannedAt: PLANNED_AT, completedOn: MONDAY },
        ] })],
    ])("rejects malformed focus plan data", (value) => {
        expect(parseFocusPlanAttribute(value)).toEqual({ valid: false });
    });

    it("toggles today and tomorrow while rejecting past and after-deadline dates", () => {
        const today = toggleQuickFocusDate(EMPTY_FOCUS_PLAN, TUESDAY, TUESDAY, WEDNESDAY, PLANNED_AT);
        expect(today).toMatchObject({ changed: true, plan: { entries: [{ date: TUESDAY }] } });
        if (!today.changed) throw new Error("expected focus plan change");
        const tomorrow = toggleQuickFocusDate(today.plan, WEDNESDAY, TUESDAY, WEDNESDAY, PLANNED_AT);
        expect(tomorrow).toMatchObject({ changed: true, plan: { entries: [{ date: TUESDAY }, { date: WEDNESDAY }] } });
        expect(toggleQuickFocusDate(today.plan, MONDAY, TUESDAY, WEDNESDAY, PLANNED_AT))
            .toEqual({ changed: false, reason: "past-date" });
        expect(toggleQuickFocusDate(today.plan, THURSDAY, TUESDAY, WEDNESDAY, PLANNED_AT))
            .toEqual({ changed: false, reason: "after-deadline" });
    });

    it("cancels all outstanding carried dates when today's focus is toggled off", () => {
        const result = toggleQuickFocusDate(
            plan(MONDAY, TUESDAY),
            WEDNESDAY,
            WEDNESDAY,
            TUESDAY,
            PLANNED_AT,
        );
        expect(result).toEqual({ changed: true, plan: EMPTY_FOCUS_PLAN });
    });

    it("toggles an exact calendar date without removing other selected dates", () => {
        const original = plan(MONDAY, TUESDAY);
        const added = toggleFocusDate(
            original,
            WEDNESDAY,
            WEDNESDAY,
            THURSDAY,
            PLANNED_AT,
        );
        expect(added).toMatchObject({
            changed: true,
            plan: { entries: [{ date: MONDAY }, { date: TUESDAY }, { date: WEDNESDAY }] },
        });
        if (!added.changed) throw new Error("expected focus plan change");
        const removed = toggleFocusDate(
            added.plan,
            TUESDAY,
            WEDNESDAY,
            THURSDAY,
            PLANNED_AT,
        );
        expect(removed).toMatchObject({
            changed: true,
            plan: { entries: [{ date: MONDAY }, { date: WEDNESDAY }] },
        });
    });

    it("stores a finite manual order on one focus entry", () => {
        const reordered = setFocusEntryOrder(plan(MONDAY, TUESDAY), MONDAY, 42);
        expect(reordered?.entries[0]).toMatchObject({ date: MONDAY, order: 42 });
        expect(setFocusEntryOrder(plan(MONDAY), WEDNESDAY, 42)).toBeUndefined();
        expect(setFocusEntryOrder(plan(MONDAY), MONDAY, Number.NaN)).toBeUndefined();
    });

    it("fulfils every due entry together, preserves future entries, and reopens only today's fulfilment", () => {
        const original = plan(MONDAY, TUESDAY, THURSDAY);
        const completed = setFocusPlanProgress(original, TUESDAY, true);
        expect(completed.entries).toEqual([
            expect.objectContaining({ date: MONDAY, completedOn: TUESDAY }),
            expect.objectContaining({ date: TUESDAY, completedOn: TUESDAY }),
            expect.not.objectContaining({ completedOn: expect.anything() }),
        ]);
        expect(setFocusPlanProgress(completed, TUESDAY, false)).toEqual(original);
    });

    it("classifies one unfulfilled item instead of duplicating carried dates", () => {
        const multiple = plan(MONDAY, TUESDAY, WEDNESDAY);
        expect(getFocusDisposition(multiple, WEDNESDAY, WEDNESDAY)).toEqual({
            kind: "carried",
            entry: multiple.entries[0],
        });
        expect(getFocusDisposition(multiple, THURSDAY, WEDNESDAY)).toEqual({
            kind: "overdue",
            entry: multiple.entries[0],
        });
        expect(isQuickFocusDateSelected(multiple, WEDNESDAY, WEDNESDAY)).toBe(true);
        expect(hasFocusDateAfterDeadline(multiple, TUESDAY)).toBe(true);
    });
});
