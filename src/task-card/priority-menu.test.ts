// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { openTaskPriorityMenu } from "./priority-menu";

const LABELS: Record<string, string> = {
    "priority.menuLabel": "Task weight",
    "priority.high": "Must advance",
    "priority.normal": "Normal",
    "priority.low": "When free",
};
const translate = (key: string): string => LABELS[key] ?? key;

function openMenu(options: Partial<Parameters<typeof openTaskPriorityMenu>[1]> = {}) {
    const anchor = document.createElement("button");
    document.body.append(anchor);
    const onSelect = vi.fn();
    openTaskPriorityMenu(anchor, { translate, onSelect, ...options });
    const menu = document.body.querySelector<HTMLElement>(".b3-menu")!;
    return { menu, onSelect };
}

describe("task priority menu", () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it("offers exactly the three levels without a separate clear entry", () => {
        const { menu } = openMenu();
        const items = Array.from(menu.querySelectorAll<HTMLButtonElement>(".b3-menu__item"));
        // 第一项是只读标题，后面三项才是可选项。
        const choices = items.filter((item) => item.dataset.type !== "readonly");
        expect(choices.map((item) => item.textContent)).toEqual([
            "🔥 Must advance",
            "➖ Normal",
            "☕ When free",
        ]);
        // 「正常推进」与「未设置」等价，因此不额外提供「清除」项。
        expect(items.some((item) => item.textContent?.includes("Clear"))).toBe(false);
    });

    it("marks the current level", () => {
        const { menu } = openMenu({ priority: "low" });
        const current = Array.from(menu.querySelectorAll<HTMLButtonElement>(".b3-menu__item"))
            .filter((item) => item.dataset.current === "true");
        expect(current).toHaveLength(1);
        expect(current[0].textContent).toBe("☕ When free");
    });

    it("reports the chosen level once", () => {
        const { menu, onSelect } = openMenu();
        const choices = Array.from(menu.querySelectorAll<HTMLButtonElement>(".b3-menu__item"))
            .filter((item) => item.dataset.type !== "readonly");
        choices[0].click();
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith("high");
    });

    it("does not open while a previous write is still in flight", () => {
        const anchor = document.createElement("button");
        document.body.append(anchor);
        openTaskPriorityMenu(anchor, {
            translate,
            disabled: true,
            onSelect: vi.fn(),
        });
        expect(document.body.querySelector(".b3-menu")).toBeNull();
    });
});
