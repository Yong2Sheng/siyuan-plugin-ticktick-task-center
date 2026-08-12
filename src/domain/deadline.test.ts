import { describe, expect, it } from "vitest";

import { DEADLINE_TRACK_SEGMENTS, getDeadlineState } from "./deadline";

describe("deadline urgency", () => {
    it.each([
        [undefined, "unset", 0],
        ["2026-08-31", "normal", 0],
        ["2026-08-19", "upcoming", 1],
        ["2026-08-18", "upcoming", 2],
        ["2026-08-15", "upcoming", 5],
        ["2026-08-13", "upcoming", 7],
        ["2026-08-12", "today", 8],
        ["2026-08-10", "overdue", 8],
    ] as const)("maps %s to %s with %s filled segments", (deadline, kind, filledSegments) => {
        expect(getDeadlineState(deadline, "2026-08-12")).toMatchObject({
            kind,
            filledSegments,
        });
    });

    it("always uses an eight-segment track", () => {
        expect(DEADLINE_TRACK_SEGMENTS).toBe(8);
    });

    it("uses calendar dates instead of elapsed hours across daylight-saving boundaries", () => {
        expect(getDeadlineState("2026-03-09", "2026-03-08")).toMatchObject({
            daysRemaining: 1,
            filledSegments: 7,
        });
    });
});
