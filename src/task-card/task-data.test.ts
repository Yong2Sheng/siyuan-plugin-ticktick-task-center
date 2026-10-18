import { describe, expect, it } from "vitest";

import { TASK_BLOCK_ATTRIBUTES, TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
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
        [TASK_BLOCK_ATTRIBUTES.url, "file:///tmp/task", "invalid-url"],
        [TASK_BLOCK_ATTRIBUTES.status, "done", "invalid-status"],
        [TASK_BLOCK_ATTRIBUTES.createdAt, "not-a-date", "invalid-created-at"],
        [TASK_BLOCK_ATTRIBUTES.updatedAt, "2026-07-12", "invalid-updated-at"],
    ])("rejects invalid %s", (key, value, reason) => {
        expect(parseTaskBlockAttributes({ ...VALID_ATTRIBUTES, [key]: value }))
            .toEqual({ valid: false, reason });
    });

    it("accepts a task whose target link is missing or empty", () => {
        const missing = { ...VALID_ATTRIBUTES };
        delete missing[TASK_BLOCK_ATTRIBUTES.url];
        expect(parseTaskBlockAttributes(missing)).toMatchObject({ valid: true, data: { url: "" } });
        expect(parseTaskBlockAttributes({ ...VALID_ATTRIBUTES, [TASK_BLOCK_ATTRIBUTES.url]: "" }))
            .toMatchObject({ valid: true, data: { url: "" } });
    });

    it("reads a valid optional deadline and rejects an invalid one", () => {
        expect(parseTaskBlockAttributes({
            ...VALID_ATTRIBUTES,
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.deadline]: "2026-08-31",
        })).toMatchObject({ valid: true, data: { deadline: "2026-08-31" } });
        expect(parseTaskBlockAttributes({
            ...VALID_ATTRIBUTES,
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.deadline]: "2026-02-31",
        })).toEqual({ valid: false, reason: "invalid-deadline" });
    });

    it("reads an optional work category while keeping legacy tasks valid", () => {
        expect(parseTaskBlockAttributes({
            ...VALID_ATTRIBUTES,
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.workMode]: "review",
        })).toMatchObject({ valid: true, data: { workMode: "review" } });
        const legacy = parseTaskBlockAttributes(VALID_ATTRIBUTES);
        expect(legacy.valid).toBe(true);
        if (legacy.valid) {
            expect(legacy.data.workMode).toBeUndefined();
        }
        expect(parseTaskBlockAttributes({
            ...VALID_ATTRIBUTES,
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.workMode]: "unknown",
        })).toEqual({ valid: false, reason: "invalid-work-mode" });
    });
});

describe("task priority parsing", () => {
    const base = {
        [TASK_BLOCK_ATTRIBUTES.card]: "true",
        [TASK_BLOCK_ATTRIBUTES.version]: "1",
        [TASK_BLOCK_ATTRIBUTES.title]: "Task",
        [TASK_BLOCK_ATTRIBUTES.url]: "https://ticktick.com/t/1",
        [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
        [TASK_BLOCK_ATTRIBUTES.createdAt]: "2026-07-12T08:30:00.000Z",
        [TASK_BLOCK_ATTRIBUTES.updatedAt]: "2026-07-12T09:30:00.000Z",
    };

    it("treats a missing or empty priority as unset instead of failing the block", () => {
        // 新增属性必须向后兼容：老任务没有这个属性，仍然必须解析成功。
        expect(parseTaskBlockAttributes(base)).toMatchObject({
            valid: true,
            data: { title: "Task" },
        });
        const withEmpty = parseTaskBlockAttributes({
            ...base,
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: "",
        });
        expect(withEmpty.valid).toBe(true);
        if (!withEmpty.valid) throw new Error("expected valid task data");
        expect(withEmpty.data.priority).toBeUndefined();
    });

    it.each([["high"], ["normal"], ["low"]])("reads the stored level %s", (priority) => {
        const parsed = parseTaskBlockAttributes({
            ...base,
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: priority,
        });
        expect(parsed.valid).toBe(true);
        if (!parsed.valid) throw new Error("expected valid task data");
        expect(parsed.data.priority).toBe(priority);
    });

    it("rejects an unrecognized priority instead of silently downgrading it", () => {
        expect(parseTaskBlockAttributes({
            ...base,
            [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: "urgent",
        })).toEqual({ valid: false, reason: "invalid-priority" });
    });
});
