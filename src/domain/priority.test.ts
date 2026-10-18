import { describe, expect, it } from "vitest";

import {
    DEFAULT_TASK_PRIORITY,
    getTaskPriorityOrder,
    isTickTickTaskPriority,
    parseTaskPriorityAttribute,
    resolveTaskPriority,
    serializeTaskPriority,
    TASK_PRIORITY_CONFIG,
    TASK_PRIORITY_IDS,
    withUnsetPriorityChoice,
} from "./priority";

describe("task priority", () => {
    it("treats a missing or empty attribute as unset", () => {
        expect(parseTaskPriorityAttribute(undefined)).toEqual({ valid: true });
        expect(parseTaskPriorityAttribute("")).toEqual({ valid: true });
    });

    it("parses the three known levels", () => {
        for (const id of TASK_PRIORITY_IDS) {
            expect(parseTaskPriorityAttribute(id)).toEqual({ valid: true, priority: id });
            expect(isTickTickTaskPriority(id)).toBe(true);
        }
    });

    it.each([
        ["urgent"],
        ["HIGH"],
        ["0"],
        [1],
        [null],
        [{}],
    ])("rejects an unrecognized stored value without guessing a level: %s", (value) => {
        expect(parseTaskPriorityAttribute(value)).toEqual({ valid: false });
        expect(isTickTickTaskPriority(value)).toBe(false);
    });

    it("maps unset to the normal level instead of a separate state", () => {
        expect(resolveTaskPriority(undefined)).toBe(DEFAULT_TASK_PRIORITY);
        expect(resolveTaskPriority("normal")).toBe("normal");
        expect(DEFAULT_TASK_PRIORITY).toBe("normal");
    });

    it("orders high before normal before low", () => {
        expect(getTaskPriorityOrder("high")).toBeLessThan(getTaskPriorityOrder("normal"));
        expect(getTaskPriorityOrder("normal")).toBeLessThan(getTaskPriorityOrder("low"));
    });

    it("serializes unset as an empty attribute value", () => {
        // 空字符串表示清除该可选字段，与 deadline / workMode 的既有语义一致。
        expect(serializeTaskPriority(undefined)).toBe("");
        expect(serializeTaskPriority("low")).toBe("low");
    });

    it("offers the three levels plus an explicit unset option in forms", () => {
        const choices = withUnsetPriorityChoice((key) => key);
        expect(choices.map((choice) => choice.value)).toEqual(["high", "normal", "low", ""]);
        expect(choices.map((choice) => choice.text)).toEqual([
            `${TASK_PRIORITY_CONFIG.high.icon} priority.high`,
            `${TASK_PRIORITY_CONFIG.normal.icon} priority.normal`,
            `${TASK_PRIORITY_CONFIG.low.icon} priority.low`,
            "priority.unset",
        ]);
    });
});
