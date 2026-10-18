import { TASK_STATUS_CONFIG, type TaskStatusTone } from "../domain/status";
import type { PersistedTickTickTaskData } from "../domain/task";
import type { Translate } from "../i18n";
import { TASK_WORK_MODE_CONFIG } from "../domain/work-mode";
import {
    resolveTaskPriority,
    TASK_PRIORITY_CONFIG,
    type TickTickTaskPriority,
} from "../domain/priority";
import {
    parseTaskTarget,
    TASK_TARGET_OPEN_LABEL_KEYS,
    type TaskTarget,
} from "../domain/task-target";

export type TaskCardViewModel = {
    translate: Translate;
    identity: string;
    linkText: string;
    title: string;
    url: string;
    /** 权重徽标文案；未设置时是「设置权重」而不是某一档。 */
    priorityText: string;
    priorityTitle: string;
    priority: TickTickTaskPriority;
    priorityConfigured: boolean;
    /** 是否今天已标记推进；决定「今日推进」按钮的状态与文案。 */
    progressedToday: boolean;
    /** 目标链接是可选字段；没有链接时为 undefined，卡片上不渲染打开控件。 */
    target?: TaskTarget;
    deadline?: string;
    workModeText: string;
    workModeTitle: string;
    workModeAriaLabel: string;
    statusText: string;
    statusTitle: string;
    statusAriaLabel: string;
    statusTone: TaskStatusTone;
    statusTerminal: boolean;
};

export function createTaskCardViewModel(
    task: PersistedTickTickTaskData,
    translate: Translate,
    options: { lastProgressedDate?: string; today?: string } = {},
): TaskCardViewModel {
    const parsedTarget = task.url.trim() === "" ? undefined : parseTaskTarget(task.url);
    if (parsedTarget && !parsedTarget.valid) {
        throw new Error(`Cannot render invalid task target: ${parsedTarget.reason}`);
    }
    const target = parsedTarget?.target;
    const status = TASK_STATUS_CONFIG[task.status];
    const statusLabel = translate(status.labelKey);
    const workModeLabel = task.workMode
        ? `${TASK_WORK_MODE_CONFIG[task.workMode].icon} ${translate(TASK_WORK_MODE_CONFIG[task.workMode].labelKey)}`
        : translate("workMode.unclassified");
    const priority = resolveTaskPriority(task.priority);
    const priorityConfigured = task.priority !== undefined;
    const priorityLabel = priorityConfigured
        ? translate(TASK_PRIORITY_CONFIG[priority].labelKey)
        : translate("priority.unset");

    return {
        translate,
        identity: translate("taskCardView.identity"),
        linkText: target
            ? `${translate(TASK_TARGET_OPEN_LABEL_KEYS[target.kind])}: ${task.title} ↗️`
            : task.title,
        title: task.title,
        url: task.url,
        priorityText: priorityConfigured
            ? `${TASK_PRIORITY_CONFIG[priority].icon} ${priorityLabel}`
            : translate("priority.unsetAction"),
        priorityTitle: translate("priority.menuTitle"),
        priority,
        priorityConfigured,
        progressedToday: options.lastProgressedDate !== undefined
            && options.lastProgressedDate === options.today,
        ...(target ? { target } : {}),
        ...(task.deadline ? { deadline: task.deadline } : {}),
        workModeText: workModeLabel,
        workModeTitle: translate("taskEdit.workModeButtonTitle"),
        workModeAriaLabel: translate("taskEdit.workModeButtonAriaLabel")
            .replace("${workMode}", workModeLabel),
        statusText: `${translate("taskCardView.status")}: ${status.icon} ${statusLabel}`,
        statusTitle: translate("taskEdit.statusButtonTitle"),
        statusAriaLabel: translate("taskEdit.statusButtonAriaLabel").replace("${status}", statusLabel),
        statusTone: status.tone,
        statusTerminal: status.terminal,
    };
}
