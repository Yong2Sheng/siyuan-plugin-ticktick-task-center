import { describe, expect, it } from "vitest";

import { isAllowedTaskTarget, parseTaskTarget } from "./task-target";

describe("task target parsing", () => {
    it.each([
        ["https://ticktick.com/webapp/#p/1/tasks/2", "ticktick"],
        ["https://dida365.com/webapp/#p/1/tasks/2", "dida365"],
        ["https://example.com/resources/guide?q=task#step", "https-resource"],
    ] as const)("classifies %s as %s", (url, kind) => {
        expect(parseTaskTarget(url)).toMatchObject({ valid: true, target: { kind } });
    });

    it("accepts and normalizes a strict SiYuan block target", () => {
        expect(parseTaskTarget("siyuan://blocks/20260825232625-yidddf2")).toEqual({
            valid: true,
            target: {
                kind: "siyuan-block",
                url: "siyuan://blocks/20260825232625-yidddf2",
                blockId: "20260825232625-yidddf2",
            },
        });
    });

    it.each([
        "siyuan://blocks/not-a-block-id",
        "siyuan://blocks/20260825232625-yidddf2/",
        "siyuan://blocks//20260825232625-yidddf2",
        "siyuan://blocks/20260825232625-yidddf2/extra",
        "siyuan://documents/20260825232625-yidddf2",
        "siyuan://blocks/20260825232625-yidddf2?query=1",
        "siyuan://blocks/20260825232625-yidddf2#fragment",
    ])("rejects malformed SiYuan targets: %s", (url) => {
        expect(parseTaskTarget(url)).toEqual({ valid: false, reason: "invalid-siyuan-block" });
    });

    it.each([
        "http://example.com/task",
        "javascript:alert(1)",
        "data:text/plain,task",
        "file:///tmp/task.txt",
        "obsidian://open?vault=notes",
    ])("rejects unsupported protocols: %s", (url) => {
        expect(parseTaskTarget(url)).toEqual({ valid: false, reason: "unsupported-protocol" });
        expect(isAllowedTaskTarget(url)).toBe(false);
    });

    it("rejects embedded HTTPS credentials", () => {
        expect(parseTaskTarget("https://user:secret@example.com/task"))
            .toEqual({ valid: false, reason: "embedded-credentials" });
    });

    it("does not confuse a TickTick-looking subdomain with TickTick", () => {
        expect(parseTaskTarget("https://ticktick.com.example.com/task"))
            .toMatchObject({ valid: true, target: { kind: "https-resource" } });
    });
});
