import { TASK_STATUS_CONFIG, type TaskStatusTone } from "../domain/status";
import type { PersistedTickTickTaskData } from "../domain/task";
import type { Translate } from "../i18n";

export type TaskCardViewModel = {
    identity: string;
    linkText: string;
    title: string;
    url: string;
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

    return {
        identity: translate("taskCardView.identity"),
        linkText: `${translate("taskCardView.openTask")}: ${task.title} ↗️`,
        title: task.title,
        url: task.url,
        statusText: `${translate("taskCardView.status")}: ${status.icon} ${statusLabel}`,
        statusTitle: translate("taskEdit.statusButtonTitle"),
        statusAriaLabel: translate("taskEdit.statusButtonAriaLabel").replace("${status}", statusLabel),
        statusTone: status.tone,
    };
}
