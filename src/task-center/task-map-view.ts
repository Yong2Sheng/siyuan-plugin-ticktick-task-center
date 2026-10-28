import { TASK_STATUS_CONFIG } from "../domain/status";
import { getDeadlineState, formatDeadlineDate } from "../domain/deadline";
import { isQuickFocusDateSelected } from "../domain/focus-plan";
import type { Translate } from "../i18n";
import type { TaskCenterItem } from "./task-center-data";
import { isProgressedToday } from "./daily-progress";
import {
    descendantsOf,
    getTaskProgress,
    type TaskTree,
} from "./task-tree";
import {
    fitTaskMapView,
    layoutTaskMap,
    type TaskMapLayout,
    type TaskMapNodeLayout,
} from "./task-map-layout";
import type { TaskMapPosition } from "./task-center-view-state";

export type TaskMapUiState = {
    selectedProjectId?: string;
    zoom: number;
    panX: number;
    panY: number;
    needFit: boolean;
    hideCompleted: boolean;
};

export type TaskMapViewOptions = {
    translate: Translate;
    locale?: () => string;
    today: string;
    tree: TaskTree;
    projects: readonly TaskCenterItem[];
    collapsed: ReadonlySet<string>;
    positions: ReadonlyMap<string, TaskMapPosition>;
    state: TaskMapUiState;
    onSelectProject(projectId: string): void;
    onToggleCollapse(blockId: string): void;
    onPositionsChange(positions: Map<string, TaskMapPosition>): void;
    onHideCompletedChange(value: boolean): void;
    onEditTask(blockId: string, focus: "status" | "work-mode" | "deadline" | "priority"): void;
    onLocateTask(item: TaskCenterItem): void;
    onAddSubtask(item: TaskCenterItem): void;
    onOpenTaskMenu(event: MouseEvent, item: TaskCenterItem): void;
    onShowTaskList(): void;
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * 项目图画布。节点布局在 task-map-layout 里算好，这里只负责 DOM、交互和
 * 把坐标变更交回视图持久化；节点上的操作复用视图的回调和右键菜单。
 */
export function renderTaskMap(container: HTMLElement, options: TaskMapViewOptions): void {
    const { translate, state } = options;
    container.replaceChildren();

    if (options.projects.length === 0) {
        container.append(createEmptyState(translate, options.onShowTaskList));
        return;
    }

    const project = options.projects.find((item) => item.blockId === state.selectedProjectId)
        ?? options.projects[0];
    state.selectedProjectId = project.blockId;

    const toolbar = createToolbar(project, options);
    container.append(toolbar);

    const canvas = document.createElement("div");
    canvas.className = "ticktick-project-map__canvas";
    const viewport = document.createElement("div");
    viewport.className = "ticktick-project-map__viewport";
    const edges = document.createElementNS(SVG_NAMESPACE, "svg") as SVGSVGElement;
    edges.setAttribute("class", "ticktick-project-map__edges");
    edges.setAttribute("aria-hidden", "true");
    viewport.append(edges);
    canvas.append(viewport);

    let layout = layoutTaskMap(project.blockId, options.tree, {
        collapsed: options.collapsed,
        manualPositions: options.positions,
        hideCompleted: state.hideCompleted,
    });
    let currentPositions = new Map(options.positions);

    for (const node of layout.nodes) {
        viewport.append(createNode(node, options, layout, currentPositions, redrawEdges));
    }
    container.append(canvas);

    const hint = document.createElement("div");
    hint.className = "ticktick-project-map__hint";
    hint.textContent = translate("taskCenterView.mapHint");
    container.append(hint);

    function applyTransform(): void {
        viewport.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
        const label = toolbar.querySelector<HTMLElement>("[data-map-zoom]");
        if (label) {
            label.textContent = `${Math.round(state.zoom * 100)}%`;
        }
    }

    function redrawEdges(): void {
        edges.replaceChildren();
        for (const edge of layout.edges) {
            const from = layout.nodeById.get(edge.from);
            const to = layout.nodeById.get(edge.to);
            if (!from || !to) {
                continue;
            }
            const x1 = from.x + from.width;
            const y1 = from.y + from.height / 2;
            const x2 = to.x;
            const y2 = to.y + to.height / 2;
            const middle = (x1 + x2) / 2;
            const path = document.createElementNS(SVG_NAMESPACE, "path");
            const child = layout.nodeById.get(edge.to);
            const childItem = child ? options.tree.byId.get(child.id)?.item : undefined;
            path.setAttribute("class", "ticktick-project-map__edge"
                + (childItem?.status === "completed" ? " ticktick-project-map__edge--done" : ""));
            path.setAttribute("d", `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`);
            edges.append(path);
        }
    }

    function fit(): void {
        const fitState = fitTaskMapView(layout.bounds, canvas.clientWidth, canvas.clientHeight, {
            minZoom: canvas.clientWidth < 560 ? 0.72 : 0.4,
        });
        if (!fitState) {
            return;
        }
        state.zoom = fitState.zoom;
        state.panX = fitState.panX;
        state.panY = fitState.panY;
        applyTransform();
    }

    function zoomAt(nextZoom: number, px: number, py: number): void {
        const clamped = Math.max(0.4, Math.min(1.8, nextZoom));
        const worldX = (px - state.panX) / state.zoom;
        const worldY = (py - state.panY) / state.zoom;
        state.zoom = clamped;
        state.panX = px - worldX * clamped;
        state.panY = py - worldY * clamped;
        applyTransform();
    }

    toolbar.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (target.closest("[data-map-fit]")) {
            fit();
        } else if (target.closest("[data-map-zoom-in]")) {
            zoomAt(state.zoom + 0.15, canvas.clientWidth / 2, canvas.clientHeight / 2);
        } else if (target.closest("[data-map-zoom-out]")) {
            zoomAt(state.zoom - 0.15, canvas.clientWidth / 2, canvas.clientHeight / 2);
        } else if (target.closest("[data-map-reset]")) {
            const next = new Map(currentPositions);
            for (const node of layout.nodes) {
                next.delete(node.id);
            }
            currentPositions = next;
            state.needFit = true;
            options.onPositionsChange(next);
        }
    });

    const select = toolbar.querySelector<HTMLSelectElement>("[data-map-project]");
    select?.addEventListener("change", () => {
        if (!select.value) {
            return;
        }
        state.selectedProjectId = select.value;
        state.needFit = true;
        options.onSelectProject(select.value);
    });
    const hideCompleted = toolbar.querySelector<HTMLInputElement>("[data-map-hide-completed]");
    hideCompleted?.addEventListener("change", () => {
        state.hideCompleted = hideCompleted.checked;
        options.onHideCompletedChange(hideCompleted.checked);
    });

    canvas.addEventListener("wheel", (event) => {
        if (!(event.ctrlKey || event.metaKey)) {
            return;
        }
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        zoomAt(
            state.zoom * Math.exp(-event.deltaY * 0.0018),
            event.clientX - rect.left,
            event.clientY - rect.top,
        );
    }, { passive: false });

    canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || (event.target as Element | null)?.closest(".ticktick-project-map__node")) {
            return;
        }
        if ((event.target as Element | null)?.closest("button, select, input, label")) {
            return;
        }
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = state.panX;
        const originY = state.panY;
        canvas.classList.add("ticktick-project-map__canvas--panning");
        canvas.setPointerCapture(event.pointerId);
        const onMove = (moveEvent: PointerEvent) => {
            state.panX = originX + (moveEvent.clientX - startX);
            state.panY = originY + (moveEvent.clientY - startY);
            applyTransform();
        };
        const onUp = () => {
            canvas.classList.remove("ticktick-project-map__canvas--panning");
            canvas.removeEventListener("pointermove", onMove);
        };
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp, { once: true });
        canvas.addEventListener("pointercancel", onUp, { once: true });
    });

    function createNode(
        node: TaskMapNodeLayout,
        viewOptions: TaskMapViewOptions,
        currentLayout: TaskMapLayout,
        positions: Map<string, TaskMapPosition>,
        redraw: () => void,
    ): HTMLElement {
        const item = viewOptions.tree.byId.get(node.id)?.item;
        if (!item) {
            return document.createElement("div");
        }
        const status = TASK_STATUS_CONFIG[item.status];
        const children = viewOptions.tree.byId.get(node.id)?.children ?? [];
        const collapsed = viewOptions.collapsed.has(item.blockId);
        const progress = getTaskProgress(viewOptions.tree, item.blockId);
        const hiddenCount = descendantsOf(viewOptions.tree, item.blockId).length;
        const isRoot = node.level === 0;

        const element = document.createElement("div");
        element.className = "ticktick-project-map__node"
            + (isRoot ? " ticktick-project-map__node--root" : "");
        element.dataset.mapNode = item.blockId;
        element.dataset.statusTone = status.tone;
        element.style.left = `${node.x}px`;
        element.style.top = `${node.y}px`;
        element.style.width = `${node.width}px`;
        element.style.height = `${node.height}px`;
        element.title = viewOptions.translate("taskCenterView.mapNodeHint");

        const body = document.createElement("div");
        body.className = "ticktick-project-map__node-body";
        const head = document.createElement("div");
        head.className = "ticktick-project-map__node-head";
        if (children.length > 0) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "ticktick-project-map__node-toggle";
            toggle.setAttribute("aria-expanded", String(!collapsed));
            toggle.title = viewOptions.translate(
                collapsed ? "taskCenterView.expandSubtasks" : "taskCenterView.collapseSubtasks",
            );
            toggle.textContent = collapsed ? "▸" : "▾";
            toggle.addEventListener("click", (event) => {
                event.stopPropagation();
                viewOptions.onToggleCollapse(item.blockId);
            });
            head.append(toggle);
        }
        const title = document.createElement("button");
        title.type = "button";
        title.className = "ticktick-project-map__node-title";
        title.textContent = item.title;
        title.title = viewOptions.translate("taskCenterView.openTaskDocument");
        title.setAttribute("aria-label", title.title);
        title.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            // 双击的第二下不再重复打开；单击/键盘点击直接定位到任务原块。
            if (event.detail > 1) {
                return;
            }
            viewOptions.onLocateTask(item);
        });
        head.append(title);
        if (collapsed && hiddenCount > 0) {
            const folded = document.createElement("span");
            folded.className = "ticktick-project-map__node-folded";
            folded.textContent = `+${hiddenCount}`;
            head.append(folded);
        }
        body.append(head);

        const meta = document.createElement("div");
        meta.className = "ticktick-project-map__node-meta";
        const statusButton = document.createElement("button");
        statusButton.type = "button";
        statusButton.className = "ticktick-project-map__node-status";
        statusButton.textContent = `${status.icon} ${viewOptions.translate(status.labelKey)}`;
        statusButton.addEventListener("click", (event) => {
            event.stopPropagation();
            viewOptions.onEditTask(item.blockId, "status");
        });
        meta.append(statusButton);

        if (item.deadline) {
            const deadlineState = getDeadlineState(item.deadline, viewOptions.today, {
                closed: status.terminal,
            });
            const deadline = document.createElement("button");
            deadline.type = "button";
            deadline.className = "ticktick-project-map__node-deadline"
                + (deadlineState.kind === "overdue"
                    ? " ticktick-project-map__node-deadline--overdue"
                    : "");
            deadline.textContent = formatDeadlineDate(
                item.deadline,
                viewOptions.locale?.(),
                viewOptions.today,
            );
            deadline.title = viewOptions.translate("deadline.editTitle");
            deadline.addEventListener("click", (event) => {
                event.stopPropagation();
                viewOptions.onEditTask(item.blockId, "deadline");
            });
            meta.append(deadline);
        }
        if (isQuickFocusDateSelected(item.focusPlan, viewOptions.today, viewOptions.today)) {
            const flag = document.createElement("span");
            flag.className = "ticktick-project-map__node-flag";
            flag.textContent = "⭐";
            flag.title = viewOptions.translate("taskCenterView.focusStateToday");
            meta.append(flag);
        }
        if (isProgressedToday(item.lastProgressedDate, viewOptions.today)) {
            const flag = document.createElement("span");
            flag.className = "ticktick-project-map__node-flag";
            flag.textContent = "✨";
            flag.title = viewOptions.translate("taskCenterView.dailyProgressDone");
            meta.append(flag);
        }
        if (viewOptions.tree.orphans.has(item.blockId)) {
            const flag = document.createElement("span");
            flag.className = "ticktick-project-map__node-orphan";
            flag.textContent = "⚠️";
            flag.title = viewOptions.translate("taskCenterView.orphanTask");
            meta.append(flag);
        }
        body.append(meta);

        if (children.length > 0) {
            const rollup = document.createElement("div");
            rollup.className = "ticktick-project-map__node-rollup";
            const count = document.createElement("span");
            count.textContent = `${progress.done} / ${progress.total}`;
            const bar = document.createElement("span");
            bar.className = "ticktick-project-map__bar";
            const fill = document.createElement("i");
            fill.style.width = `${progress.percent}%`;
            bar.append(fill);
            const percent = document.createElement("span");
            percent.textContent = `${progress.percent}%`;
            const add = document.createElement("button");
            add.type = "button";
            add.className = "ticktick-project-map__node-add";
            add.title = viewOptions.translate("taskCenterView.addSubtask");
            add.textContent = "+";
            add.addEventListener("click", (event) => {
                event.stopPropagation();
                viewOptions.onAddSubtask(item);
            });
            rollup.append(count, bar, percent, add);
            body.append(rollup);
        }
        element.append(body);
        if (isRoot) {
            const badge = document.createElement("span");
            badge.className = "ticktick-project-map__node-rootbadge";
            badge.textContent = viewOptions.translate("taskCenterView.projectLabel");
            element.append(badge);
        }

        element.addEventListener("contextmenu", (event) => viewOptions.onOpenTaskMenu(event, item));
        element.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || (event.target as Element | null)?.closest("button")) {
                return;
            }
            event.stopPropagation();
            const group = [item, ...descendantsOf(viewOptions.tree, item.blockId).map((entry) => entry.item)]
                .filter((member) => currentLayout.nodeById.has(member.blockId))
                .map((member) => {
                    const memberLayout = currentLayout.nodeById.get(member.blockId);
                    if (!memberLayout) {
                        return undefined;
                    }
                    return {
                        id: member.blockId,
                        originX: memberLayout.x,
                        originY: memberLayout.y,
                        layout: memberLayout,
                        element: viewport.querySelector<HTMLElement>(`[data-map-node="${member.blockId}"]`),
                    };
                })
                .filter((member): member is NonNullable<typeof member> => Boolean(member));
            let dragging = false;
            let finished = false;
            element.setPointerCapture(event.pointerId);
            const onMove = (moveEvent: PointerEvent) => {
                const dx = (moveEvent.clientX - event.clientX) / viewOptions.state.zoom;
                const dy = (moveEvent.clientY - event.clientY) / viewOptions.state.zoom;
                if (!dragging && Math.hypot(dx, dy) * viewOptions.state.zoom < 3) {
                    return;
                }
                dragging = true;
                for (const member of group) {
                    member.element?.classList.add("ticktick-project-map__node--dragging");
                    const nextX = member.originX + dx;
                    const nextY = member.originY + dy;
                    member.layout.x = nextX;
                    member.layout.y = nextY;
                    positions.set(member.id, { x: nextX, y: nextY });
                    if (member.element) {
                        member.element.style.left = `${nextX}px`;
                        member.element.style.top = `${nextY}px`;
                    }
                }
                redraw();
            };
            const onUp = () => {
                if (finished) {
                    return;
                }
                finished = true;
                element.removeEventListener("pointermove", onMove);
                for (const member of group) {
                    member.element?.classList.remove("ticktick-project-map__node--dragging");
                }
                if (dragging) {
                    viewOptions.onPositionsChange(new Map(positions));
                }
            };
            element.addEventListener("pointermove", onMove);
            element.addEventListener("pointerup", onUp, { once: true });
            element.addEventListener("pointercancel", onUp, { once: true });
        });

        return element;
    }

    redrawEdges();
    if (state.needFit) {
        state.needFit = false;
        fit();
        if (canvas.clientWidth === 0) {
            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(fit);
            } else {
                window.setTimeout(fit, 0);
            }
        }
    } else {
        applyTransform();
    }
}

function createToolbar(project: TaskCenterItem, options: TaskMapViewOptions): HTMLElement {
    const { translate, tree, state } = options;
    const toolbar = document.createElement("div");
    toolbar.className = "ticktick-project-map__toolbar";

    const projectWrap = document.createElement("div");
    projectWrap.className = "ticktick-project-map__project";
    const label = document.createElement("span");
    label.className = "ticktick-project-map__project-label";
    label.textContent = translate("taskCenterView.projectLabel");
    const select = document.createElement("select");
    select.className = "ticktick-project-map__select";
    select.dataset.mapProject = "true";
    for (const candidate of options.projects) {
        const progress = getTaskProgress(tree, candidate.blockId);
        const option = document.createElement("option");
        option.value = candidate.blockId;
        option.textContent = `${candidate.title} · ${progress.done}/${progress.total}`;
        option.selected = candidate.blockId === project.blockId;
        select.append(option);
    }
    projectWrap.append(label, select);

    const progress = getTaskProgress(tree, project.blockId);
    const counts = document.createElement("span");
    counts.className = "ticktick-project-map__counts";
    counts.textContent = translate("taskCenterView.mapCounts")
        .replace("${done}", String(progress.done))
        .replace("${total}", String(progress.total))
        .replace("${percent}", String(progress.percent));

    const fitButton = createButton(translate("taskCenterView.mapFit"), "data-map-fit");
    const hideLabel = document.createElement("label");
    hideLabel.className = "ticktick-project-map__check";
    const hideCheckbox = document.createElement("input");
    hideCheckbox.type = "checkbox";
    hideCheckbox.dataset.mapHideCompleted = "true";
    hideCheckbox.checked = state.hideCompleted;
    hideLabel.append(hideCheckbox, translate("taskCenterView.mapHideCompleted"));
    const resetButton = createButton(translate("taskCenterView.mapResetLayout"), "data-map-reset");
    const zoomOut = createButton("−", "data-map-zoom-out");
    const zoomIn = createButton("+", "data-map-zoom-in");
    const zoomValue = document.createElement("span");
    zoomValue.className = "ticktick-project-map__zoom-value";
    zoomValue.dataset.mapZoom = "true";
    zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;

    toolbar.append(projectWrap, counts, fitButton, hideLabel, resetButton, zoomOut, zoomValue, zoomIn);
    return toolbar;
}

function createButton(label: string, dataAttribute: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "b3-button b3-button--outline ticktick-project-map__button";
    button.textContent = label;
    button.setAttribute(dataAttribute, "true");
    return button;
}

function createEmptyState(
    translate: Translate,
    onShowTaskList: () => void,
): HTMLElement {
    const state = document.createElement("div");
    state.className = "ticktick-project-map__state";
    const title = document.createElement("div");
    title.className = "ticktick-project-map__state-title";
    title.textContent = translate("taskCenterView.mapEmptyTitle");
    const description = document.createElement("div");
    description.textContent = translate("taskCenterView.mapEmptyDescription");
    const action = document.createElement("button");
    action.type = "button";
    action.className = "b3-button b3-button--outline";
    action.textContent = translate("taskCenterView.mapEmptyAction");
    action.addEventListener("click", onShowTaskList);
    state.append(title, description, action);
    return state;
}
