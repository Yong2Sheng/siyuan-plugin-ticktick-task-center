import { describe, expect, it } from "vitest";

import { normalizeTaskData, validateTaskData } from "./validation";

describe("task validation", () => {
    it("rejects HTTP URLs", () => {
        expect(validateTaskData({
            title: "Task",
            url: "http://ticktick.com/t/1",
            status: "in-progress",
            workMode: "explore",
        })).toContain("url-protocol-unsupported");
    });

    it("accepts ordinary HTTPS resources", () => {
        expect(validateTaskData({
            title: "Task",
            url: "https://example.com/t/1",
            status: "in-progress",
            workMode: "explore",
        })).toEqual([]);
    });

    it("accepts SiYuan block links and rejects malformed ones", () => {
        expect(validateTaskData({
            title: "Task",
            url: "siyuan://blocks/20260825232625-yidddf2",
            status: "in-progress",
            workMode: "explore",
        })).toEqual([]);
        expect(validateTaskData({
            title: "Task",
            url: "siyuan://blocks/not-a-block-id",
            status: "in-progress",
            workMode: "explore",
        })).toContain("url-siyuan-invalid");
    });

    it("rejects an empty title", () => {
        expect(validateTaskData({
            title: "",
            url: "https://ticktick.com/t/1",
            status: "in-progress",
            workMode: "explore",
        })).toContain("title-required");
    });

    it("rejects a whitespace-only title", () => {
        expect(validateTaskData({
            title: " \n\t ",
            url: "https://ticktick.com/t/1",
            status: "in-progress",
            workMode: "explore",
        })).toContain("title-required");
    });

    it("rejects an unknown status", () => {
        expect(validateTaskData({
            title: "Task",
            url: "https://ticktick.com/t/1",
            status: "done",
            workMode: "explore",
        })).toContain("status-invalid");
    });

    it("requires one of the four work categories", () => {
        expect(validateTaskData({
            title: "Task",
            url: "https://ticktick.com/t/1",
            status: "in-progress",
            workMode: "unknown",
        })).toContain("work-mode-invalid");
    });

    it("trims the title and normalizes the URL", () => {
        const result = normalizeTaskData({
            title: "  Task  ",
            url: "  https://ticktick.com  ",
            status: "in-progress",
            workMode: "explore",
        });
        expect(result).toEqual({
            valid: true,
            data: {
                title: "Task",
                url: "https://ticktick.com/",
                status: "in-progress",
                workMode: "explore",
            },
        });
    });

    it("accepts an optional local-date deadline and rejects malformed dates", () => {
        expect(normalizeTaskData({
            title: "Task",
            url: "https://ticktick.com/t/1",
            status: "in-progress",
            workMode: "explore",
            deadline: "2026-08-31",
        })).toMatchObject({ valid: true, data: { deadline: "2026-08-31" } });
        expect(validateTaskData({
            title: "Task",
            url: "https://ticktick.com/t/1",
            status: "in-progress",
            workMode: "explore",
            deadline: "2026-02-31",
        })).toContain("deadline-invalid");
    });
});

describe("task priority validation", () => {
    const base = {
        title: "Task",
        url: "https://example.com/t/1",
        status: "in-progress",
        workMode: "explore",
    };

    it("accepts unset, empty and the three known levels", () => {
        expect(validateTaskData(base)).toEqual([]);
        expect(validateTaskData({ ...base, priority: "" })).toEqual([]);
        expect(validateTaskData({ ...base, priority: "high" })).toEqual([]);
        expect(validateTaskData({ ...base, priority: "normal" })).toEqual([]);
        expect(validateTaskData({ ...base, priority: "low" })).toEqual([]);
    });

    it("reports an unrecognized weight as a validation error", () => {
        expect(validateTaskData({ ...base, priority: "urgent" })).toContain("priority-invalid");
    });

    it("normalizes unset back to undefined so it is not persisted as a level", () => {
        const result = normalizeTaskData({ ...base, priority: "" });
        expect(result.valid).toBe(true);
        if (!result.valid) throw new Error("expected normalized data");
        expect(result.data.priority).toBeUndefined();

        const normalized = normalizeTaskData({ ...base, priority: "low" });
        if (!normalized.valid) throw new Error("expected normalized data");
        expect(normalized.data.priority).toBe("low");
    });
});
