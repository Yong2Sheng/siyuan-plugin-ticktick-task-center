import { describe, expect, it } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { parseTaskBlockAttributes } from "./task-data";

const VALID_ATTRIBUTES: Record<string, unknown> = {
    [TASK_BLOCK_ATTRIBUTES.card]: "true",
    [TASK_BLOCK_ATTRIBUTES.version]: "1",
    [TASK_BLOCK_ATTRIBUTES.title]: "DS9 Adaptor",
    [TASK_BLOCK_ATTRIBUTES.url]: "https://dida365.com/webapp/#p/1/tasks/2",
    [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
    [TASK_BLOCK_ATTRIBUTES.createdAt]: "2026-07-12T08:30:00.000Z",
    [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-07-12T09:30:00+00:00",
};

describe("parseTaskBlockAttributes", () => {
    it("parses all seven valid task attributes", () => {
        expect(parseTaskBlockAttributes(VALID_ATTRIBUTES)).toEqual({
            valid: true,
            data: {
                version: 1,
                title: "DS9 Adaptor",
                url: "https://dida365.com/webapp/#p/1/tasks/2",
                status: "in-progress",
                createdAt: "2026-07-12T08:30:00.000Z",
                updatedAt: "2026-07-12T09:30:00+00:00",
            },
        });
    });

    it.each([
        [TASK_BLOCK_ATTRIBUTES.card, "false", "not-task-card"],
        [TASK_BLOCK_ATTRIBUTES.version, "2", "unsupported-version"],
        [TASK_BLOCK_ATTRIBUTES.title, "", "missing-title"],
        [TASK_BLOCK_ATTRIBUTES.url, "https://example.com/task", "invalid-url"],
        [TASK_BLOCK_ATTRIBUTES.status, "done", "invalid-status"],
        [TASK_BLOCK_ATTRIBUTES.createdAt, "not-a-date", "invalid-created-at"],
        [TASK_BLOCK_ATTRIBUTES.updatedAt, "2026-07-12", "invalid-updated-at"],
    ])("rejects invalid %s", (key, value, reason) => {
        expect(parseTaskBlockAttributes({ ...VALID_ATTRIBUTES, [key]: value }))
            .toEqual({ valid: false, reason });
    });
});
