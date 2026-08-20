import { Menu } from "siyuan";

import type { Translate } from "../i18n";

export type TaskActionsMenuOptions = {
    translate: Translate;
    onEdit(): void;
    onDelete(): void;
};

export function openTaskActionsMenu(
    event: MouseEvent,
    options: TaskActionsMenuOptions,
): void {
    event.preventDefault();
    event.stopPropagation();

    const menu = new Menu("ticktick-task-actions-menu");
    menu.addItem({
        icon: "iconEdit",
        label: options.translate("taskActions.edit"),
        click: () => options.onEdit(),
    });
    menu.addSeparator();
    menu.addItem({
        icon: "iconTrashcan",
        label: options.translate("taskActions.delete"),
        warning: true,
        click: () => options.onDelete(),
    });
    menu.open({ x: event.clientX, y: event.clientY });
}
