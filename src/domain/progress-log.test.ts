import { describe, expect, it } from "vitest";

import {
    EMPTY_PROGRESS_LOG,
    includeLegacyProgressDate,
    parseProgressLogAttribute,
    serializeProgressLog,
    setProgressLogDate,
} from "./progress-log";

describe("progress log", () => {
    it("parses, sorts, and serializes unique local dates", () => {
        const parsed = parseProgressLogAttribute(JSON.stringify({
            version: 1,
            dates: ["2026-09-08", "2026-09-06"],
        }));
        expect(parsed).toEqual({
            valid: true,
            log: { version: 1, dates: ["2026-09-06", "2026-09-08"] },
        });
        if (!parsed.valid) throw new Error("expected a valid progress log");
        expect(serializeProgressLog(parsed.log)).toBe(
            '{"version":1,"dates":["2026-09-06","2026-09-08"]}',
        );
    });

    it.each([
        ["not-json"],
        [JSON.stringify({ version: 2, dates: [] })],
        [JSON.stringify({ version: 1, dates: ["2026-02-31"] })],
        [JSON.stringify({ version: 1, dates: ["2026-09-08", "2026-09-08"] })],
    ])("rejects malformed history: %s", (value) => {
        expect(parseProgressLogAttribute(value)).toEqual({ valid: false });
    });

    it("adds legacy progress, toggles one date, and keeps other history", () => {
        const seeded = includeLegacyProgressDate(EMPTY_PROGRESS_LOG, "2026-09-07");
        const progressed = setProgressLogDate(seeded, "2026-09-08", true);
        expect(progressed.dates).toEqual(["2026-09-07", "2026-09-08"]);
        expect(setProgressLogDate(progressed, "2026-09-08", false).dates)
            .toEqual(["2026-09-07"]);
    });
});
