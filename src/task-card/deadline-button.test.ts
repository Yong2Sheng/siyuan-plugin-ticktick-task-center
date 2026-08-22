// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { createDeadlineButton } from "./deadline-button";

const translate = (key: string): string => ({
    "deadline.none": "No deadline",
    "deadline.setAction": "Set deadline",
    "deadline.remainingDay": "1 day left",
    "deadline.remainingDays": "${count} days left",
    "deadline.dueToday": "Due today",
    "deadline.overdueDay": "1 day overdue",
    "deadline.overdueDays": "${count} days overdue",
    "deadline.editTitle": "Edit deadline",
    "deadline.editAriaLabel": "Edit deadline: ${summary}, ${date}",
})[key] ?? key;

describe("deadline button", () => {
    it("keeps eight empty segments when no deadline is configured", () => {
        const button = createDeadlineButton({
            className: "deadline",
            translate,
            onClick: vi.fn(),
        });

        expect(button.dataset.deadlineState).toBe("unset");
        expect(button.querySelector(".deadline-summary")?.textContent).toBe("No deadline");
        expect(button.querySelector(".deadline-date")?.textContent).toBe("Set deadline");
        expect(button.querySelectorAll('.deadline-segment[data-filled="false"]')).toHaveLength(8);
    });

    it("fills the urgency track from the seventh day and opens deadline editing", () => {
        const onClick = vi.fn();
        const button = createDeadlineButton({
            className: "deadline",
            deadline: "2026-08-15",
            today: "2026-08-12",
            locale: "en-US",
            translate,
            onClick,
        });

        expect(button.dataset.deadlineState).toBe("upcoming");
        expect(button.querySelector(".deadline-summary")?.textContent).toBe("3 days left");
        expect(button.querySelectorAll('.deadline-segment[data-filled="true"]')).toHaveLength(5);
        expect(button.querySelectorAll('.deadline-segment[data-filled="false"]')).toHaveLength(3);
        button.click();
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("uses singular English labels for one day", () => {
        const upcoming = createDeadlineButton({
            className: "deadline",
            deadline: "2026-08-13",
            today: "2026-08-12",
            locale: "en-US",
            translate,
            onClick: vi.fn(),
        });
        const overdue = createDeadlineButton({
            className: "deadline",
            deadline: "2026-08-11",
            today: "2026-08-12",
            locale: "en-US",
            translate,
            onClick: vi.fn(),
        });

        expect(upcoming.querySelector(".deadline-summary")?.textContent).toBe("1 day left");
        expect(overdue.querySelector(".deadline-summary")?.textContent).toBe("1 day overdue");
    });
});
