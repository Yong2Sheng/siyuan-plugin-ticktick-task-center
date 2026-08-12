// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { createDeadlineButton } from "./deadline-button";

const translate = (key: string): string => ({
    "deadline.none": "No deadline",
    "deadline.setAction": "Set deadline",
    "deadline.remainingDays": "${count} days left",
    "deadline.dueToday": "Due today",
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
});
