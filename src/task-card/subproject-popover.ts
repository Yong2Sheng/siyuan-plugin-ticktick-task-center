import { getDeadlineState } from "../domain/deadline";
import { TASK_STATUS_CONFIG } from "../domain/status";
import type { Translate } from "../i18n";
import type { SubprojectSummary } from "./subprojects";

/** 浮层里最多列几行；更多的进项目图。 */
export const SUBPROJECT_POPOVER_LIMIT = 5;

export type SubprojectPopoverOptions = {
    translate: Translate;
    today: string;
    items: readonly SubprojectSummary[];
    onOpen(item: SubprojectSummary): void;
    onOpenMap(): void;
};

type ActivePopover = {
    element: HTMLElement;
    anchor: HTMLElement;
    dispose(): void;
};

let activePopover: ActivePopover | undefined;

/** 卡片重建、路由切换或插件卸载时，确保浮层不会留在页面上。 */
export function closeSubprojectPopover(): void {
    activePopover?.dispose();
    activePopover = undefined;
}

/**
 * 只在浮层的触发按钮已经被移出文档时关闭。
 * 文档里其它任务块被扫描 / 重建时不能误关正在看的浮层。
 */
export function closeSubprojectPopoverIfDetached(): void {
    if (activePopover && !activePopover.anchor.isConnected) {
        closeSubprojectPopover();
    }
}

/** 同一个胶囊再次点击时收起；不同胶囊则切换到新的浮层。 */
export function toggleSubprojectPopover(
    anchor: HTMLElement,
    options: SubprojectPopoverOptions,
): void {
    if (activePopover?.anchor === anchor) {
        closeSubprojectPopover();
        return;
    }
    openSubprojectPopover(anchor, options);
}

/**
 * 文档卡片上的子项目浮层。
 *
 * 只负责把已经加载好的子项目列出来；打开行、打开项目图都交回调用方。
 * 用 fixed 定位贴着胶囊，视口下方放不下就向上翻，点击外部 / Esc / 滚动时关闭。
 */
export function openSubprojectPopover(
    anchor: HTMLElement,
    options: SubprojectPopoverOptions,
): void {
    closeSubprojectPopover();
    const { translate } = options;
    const title = translate("taskCardView.subprojectsPopoverTitle")
        .replace("${count}", String(options.items.length));

    const element = document.createElement("div");
    element.className = "ticktick-subproject-popover";
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-label", title);

    const head = document.createElement("div");
    head.className = "ticktick-subproject-popover__head";
    const heading = document.createElement("span");
    heading.className = "ticktick-subproject-popover__title";
    heading.textContent = title;
    const mapButton = document.createElement("button");
    mapButton.type = "button";
    mapButton.className = "ticktick-subproject-popover__map";
    mapButton.textContent = translate("taskCardView.subprojectsOpenMap");
    mapButton.addEventListener("click", () => {
        options.onOpenMap();
        closeSubprojectPopover();
    });
    head.append(heading, mapButton);

    const list = document.createElement("ul");
    list.className = "ticktick-subproject-popover__list";
    const visible = options.items.slice(0, SUBPROJECT_POPOVER_LIMIT);
    for (const item of visible) {
        list.append(createRow(item, options));
    }

    element.append(head, list);

    if (options.items.length > visible.length) {
        const foot = document.createElement("div");
        foot.className = "ticktick-subproject-popover__foot";
        const more = document.createElement("button");
        more.type = "button";
        more.className = "ticktick-subproject-popover__more";
        more.textContent = translate("taskCardView.subprojectsViewAll")
            .replace("${count}", String(options.items.length));
        more.addEventListener("click", () => {
            options.onOpenMap();
            closeSubprojectPopover();
        });
        foot.append(more);
        element.append(foot);
    }

    document.body.append(element);
    positionPopover(element, anchor);

    const onPointerDown = (event: PointerEvent): void => {
        const target = event.target;
        if (!(target instanceof Node)) {
            return;
        }
        if (element.contains(target) || anchor.contains(target)) {
            return;
        }
        dispose(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
            event.preventDefault();
            dispose(true);
        }
    };
    const onWindowChange = (): void => dispose(false);
    const dispose = (restoreFocus: boolean): void => {
        if (activePopover?.element !== element) {
            return;
        }
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("resize", onWindowChange);
        window.removeEventListener("scroll", onWindowChange, true);
        element.remove();
        activePopover = undefined;
        if (restoreFocus && anchor.isConnected) {
            anchor.focus({ preventScroll: true });
        }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);

    activePopover = { element, anchor, dispose: () => dispose(false) };

    list.querySelector<HTMLButtonElement>(".ticktick-subproject-popover__row")
        ?.focus({ preventScroll: true });
}

function createRow(
    item: SubprojectSummary,
    options: SubprojectPopoverOptions,
): HTMLElement {
    const status = TASK_STATUS_CONFIG[item.status];
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ticktick-subproject-popover__row";
    button.dataset.tone = status.tone;
    button.title = item.title;

    const dot = document.createElement("span");
    dot.className = "ticktick-subproject-popover__dot";

    const body = document.createElement("span");
    body.className = "ticktick-subproject-popover__body";
    const name = document.createElement("span");
    name.className = "ticktick-subproject-popover__name";
    name.textContent = item.title;
    const meta = document.createElement("span");
    meta.className = "ticktick-subproject-popover__meta";
    meta.textContent = formatMeta(item, options);
    body.append(name, meta);

    const chevron = document.createElement("span");
    chevron.className = "ticktick-subproject-popover__chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "›";

    button.append(dot, body, chevron);
    button.addEventListener("click", () => {
        options.onOpen(item);
        closeSubprojectPopover();
    });
    row.append(button);
    return row;
}

function formatMeta(item: SubprojectSummary, options: SubprojectPopoverOptions): string {
    const status = TASK_STATUS_CONFIG[item.status];
    const label = `${status.icon} ${options.translate(status.labelKey)}`;
    if (!item.deadline) {
        return label;
    }
    const state = getDeadlineState(item.deadline, options.today, { closed: status.terminal });
    switch (state.kind) {
        case "closed":
            return `${label} · ${options.translate("deadline.closed")}`;
        case "today":
            return `${label} · ${options.translate("deadline.dueToday")}`;
        case "overdue": {
            const count = Math.abs(state.daysRemaining ?? 0);
            return `${label} · ${formatDays(
                options.translate(count === 1 ? "deadline.overdueDay" : "deadline.overdueDays"),
                count,
            )}`;
        }
        case "unset":
            return label;
        default: {
            const count = state.daysRemaining ?? 0;
            return `${label} · ${formatDays(
                options.translate(count === 1 ? "deadline.remainingDay" : "deadline.remainingDays"),
                count,
            )}`;
        }
    }
}

function formatDays(template: string, count: number): string {
    return template.replace("${count}", String(count));
}

function positionPopover(element: HTMLElement, anchor: HTMLElement): void {
    const anchorRect = anchor.getBoundingClientRect();
    element.style.left = `${Math.round(anchorRect.left)}px`;
    element.style.top = `${Math.round(anchorRect.bottom + 6)}px`;

    const rect = element.getBoundingClientRect();
    const margin = 8;
    if (rect.right > window.innerWidth - margin) {
        element.style.left = `${Math.max(margin, Math.round(window.innerWidth - rect.width - margin))}px`;
    }
    if (rect.bottom > window.innerHeight - margin) {
        const above = Math.round(anchorRect.top - rect.height - 6);
        element.style.top = above >= margin
            ? `${above}px`
            : `${Math.max(margin, Math.round(window.innerHeight - rect.height - margin))}px`;
    }
}
