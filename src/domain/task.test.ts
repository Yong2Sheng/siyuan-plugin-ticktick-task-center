import { describe, expect, it } from "vitest";

import {
    createTaskBlockAttributes,
    createTaskFallbackMarkdown,
    escapeMarkdownLinkTitle,
    TASK_BLOCK_ATTRIBUTES,
    TASK_DATA_VERSION,
} from "./task";

describe("Markdown fallback", () => {
    it("escapes backslashes in link titles", () => {
        expect(escapeMarkdownLinkTitle("a\\b")).toBe("a\\\\b");
    });

    it("escapes square brackets in link titles", () => {
        expect(escapeMarkdownLinkTitle("a[b]c")).toBe("a\\[b\\]c");
    });

    it("replaces CR and LF characters so they cannot break the link", () => {
        expect(createTaskFallbackMarkdown("Task", "a\r\nb\rc\nd", "https://ticktick.com/t/1"))
            .toBe("Task：[a b c d](https://ticktick.com/t/1)");
    });
});

describe("task block attributes", () => {
    const timestamp = "2026-07-12T08:30:00.000Z";
    const attributes = createTaskBlockAttributes({
        version: TASK_DATA_VERSION,
        title: "Task",
        url: "https://ticktick.com/t/1",
        status: "in-progress",
        createdAt: timestamp,
        updatedAt: timestamp,
    });

    it("creates all seven structured attributes", () => {
        expect(Object.keys(attributes)).toHaveLength(7);
        expect(attributes).toEqual({
            [TASK_BLOCK_ATTRIBUTES.card]: "true",
            [TASK_BLOCK_ATTRIBUTES.version]: "1",
            [TASK_BLOCK_ATTRIBUTES.title]: "Task",
            [TASK_BLOCK_ATTRIBUTES.url]: "https://ticktick.com/t/1",
            [TASK_BLOCK_ATTRIBUTES.status]: "in-progress",
            [TASK_BLOCK_ATTRIBUTES.createdAt]: timestamp,
            [TASK_BLOCK_ATTRIBUTES.updatedAt]: timestamp,
        });
    });

    it("uses the same valid ISO timestamp for initial creation and update times", () => {
        expect(attributes[TASK_BLOCK_ATTRIBUTES.createdAt])
            .toBe(attributes[TASK_BLOCK_ATTRIBUTES.updatedAt]);
        expect(new Date(attributes[TASK_BLOCK_ATTRIBUTES.createdAt]).toISOString()).toBe(timestamp);
    });
});
