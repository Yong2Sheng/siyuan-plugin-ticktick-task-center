import type { App, Custom, Plugin, Tab } from "siyuan";

export const TASK_CENTER_TAB_TYPE = "ticktick-task-center";
export const TASK_CENTER_ICON_ID = "iconTickTickTaskCenter";

const TASK_CENTER_ICON = `<symbol id="${TASK_CENTER_ICON_ID}" viewBox="0 0 32 32">
    <rect x="7" y="7" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2.4"/>
    <path d="m10 12 2 2 4-4M18 12h4M10 19l2 2 4-4M18 19h4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"/>
</symbol>`;

let nextTabInstanceId = 1;

export type TaskCenterTabInstance = {
    start(): void | Promise<void>;
    destroy(): void;
};

export type OpenCustomTab = (options: {
    app: App;
    custom: {
        id: string;
        icon: string;
        title: string;
    };
    keepCursor?: boolean;
}) => Promise<Tab>;

export type TaskCenterTabOptions = {
    translate(key: string): string;
    openTab: OpenCustomTab;
    createInstance(target: HTMLElement, instanceId: string): TaskCenterTabInstance;
};

export class TaskCenterTabService {
    private readonly instances = new Map<Custom, TaskCenterTabInstance>();
    private currentTab?: Tab;
    private opening?: Promise<Tab | undefined>;
    private topBarElement?: HTMLElement;
    private registered = false;
    private stopped = false;
    private readonly closedTabs = new WeakSet<Tab>();

    constructor(
        private readonly plugin: Plugin,
        private readonly options: TaskCenterTabOptions,
    ) {}

    registerTab(): void {
        if (this.registered) {
            return;
        }
        this.stopped = false;
        this.registered = true;
        this.plugin.addIcons(TASK_CENTER_ICON);
        const service = this;
        this.plugin.addTab({
            type: TASK_CENTER_TAB_TYPE,
            init(this: Custom) {
                if (service.stopped) {
                    service.closeTab(this.tab);
                    return;
                }
                if (!(this.element instanceof HTMLElement)) {
                    return;
                }
                const instanceId = `task-center-tab-${nextTabInstanceId++}`;
                this.element.dataset.ticktickTaskCenterInstance = instanceId;
                const instance = service.options.createInstance(this.element, instanceId);
                service.instances.set(this, instance);
                service.currentTab = this.tab;
                void instance.start();
            },
            destroy(this: Custom) {
                service.instances.get(this)?.destroy();
                service.instances.delete(this);
                if (service.currentTab === this.tab) {
                    service.currentTab = undefined;
                }
            },
        });
    }

    mountTopBar(): void {
        if (this.stopped || this.topBarElement) {
            return;
        }
        this.topBarElement = this.plugin.addTopBar({
            icon: TASK_CENTER_ICON_ID,
            title: this.options.translate("taskCenterView.openTooltip"),
            position: "right",
            callback: () => void this.open(),
        });
    }

    async open(): Promise<void> {
        if (this.stopped) {
            return;
        }
        if (this.currentTab) {
            this.focus(this.currentTab);
            return;
        }
        if (this.opening) {
            const tab = await this.opening;
            if (!tab) {
                return;
            }
            if (this.stopped) {
                this.closeTab(tab);
                return;
            }
            if (this.currentTab === tab) {
                this.focus(tab);
            }
            return;
        }

        let opening: Promise<Tab | undefined>;
        try {
            opening = this.options.openTab({
                app: this.plugin.app,
                custom: {
                    id: this.plugin.name + TASK_CENTER_TAB_TYPE,
                    icon: TASK_CENTER_ICON_ID,
                    title: this.options.translate("taskCenterView.title"),
                },
                keepCursor: false,
            }).catch((error: unknown) => {
                console.error("Failed to open TickTick Task Center tab", error);
                return undefined;
            });
        } catch (error) {
            console.error("Failed to open TickTick Task Center tab", error);
            return;
        }
        this.opening = opening;
        try {
            const tab = await opening;
            if (!tab) {
                return;
            }
            if (this.stopped) {
                this.closeTab(tab);
                return;
            }
            this.currentTab = tab;
        } finally {
            if (this.opening === opening) {
                this.opening = undefined;
            }
        }
    }

    stop(): void {
        this.stopped = true;
        this.topBarElement?.remove();
        this.topBarElement = undefined;
        const tab = this.currentTab;
        this.currentTab = undefined;
        const instances = Array.from(this.instances.values());
        this.instances.clear();
        if (tab) {
            this.closeTab(tab);
        }
        for (const instance of instances) {
            instance.destroy();
        }
    }

    private focus(tab: Tab): void {
        tab.parent.switchTab(tab.headElement);
    }

    private closeTab(tab: Tab): void {
        if (this.closedTabs.has(tab)) {
            return;
        }
        this.closedTabs.add(tab);
        tab.close();
    }
}
