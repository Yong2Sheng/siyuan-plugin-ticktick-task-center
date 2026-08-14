import { TASK_STATUS_CONFIG, type TaskStatusTone } from "../domain/status";
import type { PersistedTickTickTaskData } from "../domain/task";
import type { Translate } from "../i18n";
import { TASK_WORK_MODE_CONFIG } from "../domain/work-mode";

export type TaskCardViewModel = {
    translate: Translate;
    identity: string;
    linkText: string;
    title: string;
    url: string;
    deadline?: string;
    workModeText: string;
    workModeTitle: string;
    workModeAriaLabel: string;
    statusText: string;
    statusTitle: string;
    statusAriaLabel: string;
    statusTone: TaskStatusTone;
};

export function createTaskCardViewModel(
    task: PersistedTickTickTaskData,
    translate: Translate,
): TaskCardViewModel {
    const status = TASK_STATUS_CONFIG[task.status];
    const statusLabel = translate(status.labelKey);
    const workModeLabel = task.workMode
        ? `${TASK_WORK_MODE_CONFIG[task.workMode].icon} ${translate(TASK_WORK_MODE_CONFIG[task.workMode].labelKey)}`
        : translate("workMode.unclassified");

    return {
        translate,
        identity: translate("taskCardView.identity"),
        linkText: `${translate("taskCardView.openTask")}: ${task.title} ↗️`,
        title: task.title,
        url: task.url,
        ...(task.deadline ? { deadline: task.deadline } : {}),
        workModeText: workModeLabel,
        workModeTitle: translate("taskEdit.workModeButtonTitle"),
        workModeAriaLabel: translate("taskEdit.workModeButtonAriaLabel")
            .replace("${workMode}", workModeLabel),
        statusText: `${translate("taskCardView.status")}: ${status.icon} ${statusLabel}`,
        statusTitle: translate("taskEdit.statusButtonTitle"),
        statusAriaLabel: translate("taskEdit.statusButtonAriaLabel").replace("${status}", statusLabel),
        statusTone: status.tone,
    };
}
