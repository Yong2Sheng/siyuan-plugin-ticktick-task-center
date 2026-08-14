import { describe, expect, it } from "vitest";

import { isAllowedTickTickUrl, normalizeTaskData, validateTaskData } from "./validation";

describe("TickTick task validation", () => {
    it("accepts an HTTPS dida365.com URL", () => {
        expect(isAllowedTickTickUrl("https://dida365.com/webapp/#p/1/tasks/2")).toBe(true);
    });

    it("accepts an HTTPS ticktick.com URL", () => {
        expect(isAllowedTickTickUrl("https://ticktick.com/webapp/#p/1/tasks/2")).toBe(true);
    });

    it("rejects HTTP URLs", () => {
        expect(validateTaskData({
            title: "Task",
            url: "http://ticktick.com/t/1",
            status: "in-progress",
            workMode: "explore",
        })).toContain("url-https-required");
    });

    it("rejects non-TickTick hosts", () => {
        expect(validateTaskData({
            title: "Task",
            url: "https://example.com/t/1",
            status: "in-progress",
            workMode: "explore",
        })).toContain("url-host-invalid");
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
