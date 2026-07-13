// @vitest-environment jsdom

import type { Custom, Plugin, Tab } from "siyuan";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TASK_CENTER_TAB_TYPE, TaskCenterTabService } from "./task-center-tab";

type TabConfig = {
    type: string;
    init(this: Custom): void;
    update?(this: Custom): void;
    destroy?(this: Custom): void;
};

function createHarness() {
    let tabConfig: TabConfig | undefined;
    const topBar = document.createElement("button");
    const addIcons = vi.fn();
    const addTopBar = vi.fn(() => topBar);
    const addTab = vi.fn((config: TabConfig) => {
        tabConfig = config;
        return vi.fn();
    });
    const switchTab = vi.fn();
    const close = vi.fn();
    const plugin = {
        app: {},
        name: "siyuan-plugin-ticktick-task-center",
        addIcons,
        addTopBar,
        addTab,
    } as unknown as Plugin;
    const instance = { start: vi.fn(), destroy: vi.fn() };
    const createInstance = vi.fn(() => instance);
    const openTab = vi.fn(async () => {
        const tab = {
            parent: { switchTab },
            headElement: document.createElement("div"),
            close,
        } as unknown as Tab;
        const custom = {
            element: document.createElement("div"),
            tab,
        } as unknown as Custom;
        Object.assign(tab, { model: custom });
        tabConfig?.init.call(custom);
        return tab;
    });
    const service = new TaskCenterTabService(plugin, {
        translate: (key) => key,
        openTab,
        createInstance,
    });
    service.registerTab();
    return {
        service,
        tabConfig: () => tabConfig,
        topBar,
        addIcons,
        addTopBar,
        addTab,
        openTab,
        createInstance,
        instance,
        switchTab,
        close,
    };
}

describe("TaskCenterTabService", () => {
    beforeEach(() => document.body.replaceChildren());

    it("registers a namespaced custom tab and a top bar entry", () => {
        const harness = createHarness();
        harness.service.mountTopBar();

        expect(harness.addIcons).toHaveBeenCalledOnce();
        expect(harness.addTab).toHaveBeenCalledOnce();
        expect(harness.tabConfig()?.type).toBe(TASK_CENTER_TAB_TYPE);
        expect(harness.addTopBar).toHaveBeenCalledWith(expect.objectContaining({
            title: "taskCenterView.openTooltip",
            position: "right",
        }));
    });

    it("creates and starts one tab, then only focuses the existing tab", async () => {
        const harness = createHarness();

        await harness.service.open();
        await harness.service.open();

        expect(harness.openTab).toHaveBeenCalledOnce();
        expect(harness.createInstance).toHaveBeenCalledOnce();
        expect(harness.switchTab).toHaveBeenCalledOnce();
        expect(harness.instance.start).toHaveBeenCalledOnce();
    });

    it("coalesces simultaneous open requests", async () => {
        const harness = createHarness();
        await Promise.all([harness.service.open(), harness.service.open()]);
        expect(harness.openTab).toHaveBeenCalledOnce();
    });

    it("handles an openTab rejection and allows a later retry", async () => {
        const harness = createHarness();
        const error = new Error("open failed");
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        harness.openTab.mockRejectedValueOnce(error);

        await expect(harness.service.open()).resolves.toBeUndefined();
        await expect(harness.service.open()).resolves.toBeUndefined();

        expect(harness.openTab).toHaveBeenCalledTimes(2);
        expect(harness.createInstance).toHaveBeenCalledOnce();
        expect(consoleError).toHaveBeenCalledWith("Failed to open TickTick Task Center tab", error);
        consoleError.mockRestore();
    });

    it("allows a new tab after the custom tab is destroyed", async () => {
        const harness = createHarness();
        await harness.service.open();
        const firstCustom = harness.openTab.mock.results[0]?.value
            ? (await harness.openTab.mock.results[0].value).model as Custom
            : undefined;
        harness.tabConfig()?.destroy?.call(firstCustom!);

        await harness.service.open();

        expect(harness.instance.destroy).toHaveBeenCalledOnce();
        expect(harness.openTab).toHaveBeenCalledTimes(2);
    });

    it("cleans the top bar, tab, and mounted view when stopped", async () => {
        const harness = createHarness();
        harness.service.mountTopBar();
        const remove = vi.spyOn(harness.topBar, "remove");
        await harness.service.open();

        harness.service.stop();

        expect(remove).toHaveBeenCalledOnce();
        expect(harness.close).toHaveBeenCalledOnce();
        expect(harness.instance.destroy).toHaveBeenCalledOnce();
    });

    it("does not retain a tab that resolves after the service is stopped", async () => {
        let resolveTab!: (tab: Tab) => void;
        const harness = createHarness();
        const close = vi.fn();
        harness.openTab.mockImplementationOnce(() => new Promise<Tab>((resolve) => {
            resolveTab = resolve;
        }));

        const opening = harness.service.open();
        harness.service.stop();
        resolveTab({ close } as unknown as Tab);
        await opening;

        expect(close).toHaveBeenCalledOnce();
        expect(harness.createInstance).not.toHaveBeenCalled();
    });

    it("closes once and never focuses when simultaneous opens resolve after stop", async () => {
        let resolveTab!: (tab: Tab) => void;
        const harness = createHarness();
        const close = vi.fn();
        harness.openTab.mockImplementationOnce(() => new Promise<Tab>((resolve) => {
            resolveTab = resolve;
        }));
        const tab = {
            parent: { switchTab: harness.switchTab },
            headElement: document.createElement("div"),
            close,
        } as unknown as Tab;

        const first = harness.service.open();
        const second = harness.service.open();
        harness.service.stop();
        resolveTab(tab);
        await Promise.all([first, second]);

        expect(close).toHaveBeenCalledOnce();
        expect(harness.switchTab).not.toHaveBeenCalled();
    });
});
