import { Menu } from "siyuan";

import {
    TASK_PRIORITY_CONFIG,
    TASK_PRIORITY_IDS,
    type TickTickTaskPriority,
} from "../domain/priority";
import type { Translate } from "../i18n";

/** 菜单从触发按钮的哪个角弹出。默认贴按钮下方，剪贴板/窄屏场景可改成上方。 */
export type PriorityMenuAnchor = "below" | "above";

export type PriorityMenuOptions = {
    translate: Translate;
    priority?: TickTickTaskPriority;
    /** 菜单打开期间禁止重复提交（例如上一次写入还没回来）。 */
    disabled?: boolean;
    anchor?: PriorityMenuAnchor;
    onSelect(next: TickTickTaskPriority): void;
};

/**
 * 任务权重菜单。
 *
 * 只提供三档：选中「正常推进」即清空属性，因为「正常推进」与「未设置」语义等同，
 * 多给一个「清除」项等于让两个选项做同一件事。
 */
export function openTaskPriorityMenu(
    anchorElement: HTMLElement,
    options: PriorityMenuOptions,
): void {
    if (options.disabled) {
        return;
    }
    const { translate } = options;
    const menu = new Menu("ticktick-task-priority-menu");
    menu.addItem({
        label: translate("priority.menuLabel"),
        type: "readonly",
    });
    menu.addSeparator();
    for (const id of TASK_PRIORITY_IDS) {
        const config = TASK_PRIORITY_CONFIG[id];
        menu.addItem({
            label: `${config.icon} ${translate(config.labelKey)}`,
            current: id === options.priority,
            disabled: Boolean(options.disabled),
            click: () => options.onSelect(id),
        });
    }

    const rect = anchorElement.getBoundingClientRect();
    const anchor = options.anchor ?? "below";
    menu.open({
        x: rect.left,
        y: anchor === "below" ? rect.bottom : rect.top,
    });
}
