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
