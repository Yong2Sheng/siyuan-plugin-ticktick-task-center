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
        })).toContain("url-https-required");
    });

    it("rejects non-TickTick hosts", () => {
        expect(validateTaskData({
            title: "Task",
            url: "https://example.com/t/1",
            status: "in-progress",
        })).toContain("url-host-invalid");
    });

    it("rejects an empty title", () => {
        expect(validateTaskData({
            title: "",
            url: "https://ticktick.com/t/1",
            status: "in-progress",
        })).toContain("title-required");
    });

    it("rejects a whitespace-only title", () => {
        expect(validateTaskData({
            title: " \n\t ",
            url: "https://ticktick.com/t/1",
            status: "in-progress",
        })).toContain("title-required");
    });

    it("rejects an unknown status", () => {
        expect(validateTaskData({
            title: "Task",
            url: "https://ticktick.com/t/1",
            status: "done",
        })).toContain("status-invalid");
    });

    it("trims the title and normalizes the URL", () => {
        const result = normalizeTaskData({
            title: "  Task  ",
            url: "  https://ticktick.com  ",
            status: "in-progress",
        });
        expect(result).toEqual({
            valid: true,
            data: {
                title: "Task",
                url: "https://ticktick.com/",
                status: "in-progress",
            },
        });
    });
});
