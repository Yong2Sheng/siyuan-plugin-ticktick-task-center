import { describe, expect, it } from "vitest";

import { TASK_STATUS_CONFIG, TASK_STATUS_IDS } from "../domain/status";
import { createTaskCardViewModel } from "./card-view-model";

const translate = (key: string): string => ({
    "taskCardView.identity": "TickTick task",
    "taskCardView.openTask": "Open task",
    "taskCardView.status": "Status",
    "taskEdit.statusButtonTitle": "Click to edit task",
    "taskEdit.statusButtonAriaLabel": "Edit task, current status: ${status}",
    "taskEdit.workModeButtonTitle": "Click to edit work category",
    "taskEdit.workModeButtonAriaLabel": "Edit task, current work category: ${workMode}",
    "workMode.review": "评审-Review",
    "workMode.unclassified": "未分类-Unclassified",
    "status.todo": "To do",
    "status.inProgress": "In progress",
    "status.waiting": "Waiting for response",
    "status.blocked": "Blocked",
    "status.completed": "Completed",
    "status.failed": "Failed",
    "status.cancelled": "Cancelled",
})[key] ?? key;

describe("createTaskCardViewModel", () => {
    it.each(TASK_STATUS_IDS)("uses unified status metadata for %s", (status) => {
        const viewModel = createTaskCardViewModel({
            version: 1,
            title: "DS9 Adaptor",
            url: "https://ticktick.com/task/1",
            status,
            createdAt: "2026-07-12T08:30:00.000Z",
            updatedAt: "2026-07-12T08:30:00.000Z",
        }, translate);
        const config = TASK_STATUS_CONFIG[status];

        expect(viewModel.statusText).toContain(config.icon);
        expect(viewModel.statusText).toContain(translate(config.labelKey));
        expect(viewModel.statusTone).toBe(config.tone);
    });

    it("uses translated UI labels and carries task fields into the model", () => {
        const viewModel = createTaskCardViewModel({
            version: 1,
            title: "DS9 Adaptor",
            url: "https://ticktick.com/task/1",
            status: "in-progress",
            workMode: "review",
            deadline: "2026-08-31",
            createdAt: "2026-07-12T08:30:00.000Z",
            updatedAt: "2026-07-12T08:30:00.000Z",
        }, translate);

        expect(viewModel.identity).toBe("TickTick task");
        expect(viewModel.linkText).toBe("Open task: DS9 Adaptor ↗️");
        expect(viewModel.statusTitle).toBe("Click to edit task");
        expect(viewModel.statusAriaLabel).toBe("Edit task, current status: In progress");
        expect(viewModel.workModeText).toBe("🔎 评审-Review");
        expect(viewModel.workModeTitle).toBe("Click to edit work category");
        expect(viewModel.title).toBe("DS9 Adaptor");
        expect(viewModel.url).toBe("https://ticktick.com/task/1");
        expect(viewModel.deadline).toBe("2026-08-31");
    });
});
