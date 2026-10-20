// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import { InboxController } from "./inbox-controller";
import { INBOX_STORE_VERSION, type InboxStore } from "./inbox-store";
import { InboxView } from "./inbox-view";

const TODAY = new Date(2026, 9, 11, 14, 32, 0);
const YESTERDAY = new Date(2026, 9, 10, 9, 20, 0);

const translate = ((key: string) => ({
    "inbox.captureLabel": "记一笔",
    "inbox.titleLabel": "标题",
    "inbox.bodyLabel": "正文（可选）",
    "inbox.titlePlaceholder": "要做什么？",
    "inbox.bodyPlaceholder": "正文：背景、前因后果",
    "inbox.captureHint": "回车记一笔",
    "inbox.captureSubmit": "记一笔",
    "inbox.tierGroupLabel": "条目分级",
    "inbox.tierQuick": "⚡ 快速事项",
    "inbox.tierFormal": "🔬 正式任务",
    "inbox.summaryPending": "待处理",
    "inbox.summaryQuick": "⚡ 快速事项",
    "inbox.summaryFormal": "🔬 正式任务",
    "inbox.summaryDoneToday": "✓ 今日已完成",
    "inbox.groupQuickHint": "顺手就能办完",
    "inbox.groupFormalHint": "要进项目慢慢做",
    "inbox.complete": "✓ 完成",
    "inbox.promote": "→ 移入任务清单",
    "inbox.delete": "🗑",
    "inbox.deleteTitle": "删除这张便条",
    "inbox.edit": "编辑",
    "inbox.editTitle": "编辑便条",
    "inbox.preview": "预览",
    "inbox.previewHint": "实时 · 与列表一致",
    "inbox.hidePreview": "隐藏预览",
    "inbox.showPreview": "显示预览",
    "inbox.previewEmpty": "正文为空，列表里只显示标题。",
    "inbox.retierToFormal": "改为正式任务",
    "inbox.retierToQuick": "改为快速事项",
    "inbox.doneToday": "✓ 今日已完成 ${count}",
    "inbox.doneTodayHint": "不计入任务统计",
    "inbox.loading": "正在加载收件箱……",
    "inbox.loadFailed": "无法加载收件箱。",
    "inbox.retry": "重试",
    "inbox.empty": "收件箱是空的。",
    "inbox.droppedNotes": "有 ${count} 张便条数据不完整，已跳过。",
    "inbox.bodyExpand": "展开正文 ▾",
    "inbox.bodyCollapse": "收起正文 ▴",
}[key] ?? key)) as Translate;

function note(id: string, text: string, tier: "quick" | "formal", createdAt: Date, completedAt?: Date) {
    return {
        id,
        text,
        tier,
        createdAt: createdAt.toISOString(),
        ...(completedAt ? { completedAt: completedAt.toISOString() } : {}),
    };
}

function setup(initialNotes: InboxStore["notes"] = [], options: { loadError?: boolean } = {}) {
    let store: InboxStore = { version: INBOX_STORE_VERSION, notes: initialNotes };
    const controller = new InboxController({
        load: async () => {
            if (options.loadError) {
                throw new Error("load failed");
            }
            return { store, droppedNoteCount: 0 };
        },
        save: async (next) => {
            store = next;
        },
        now: () => TODAY,
    });
    const onPromote = vi.fn();
    const onEdit = vi.fn();
    const onActionFailed = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const view = new InboxView(target, {
        controller,
        translate,
        locale: "zh-CN",
        onPromote,
        onEdit,
        onActionFailed,
    });
    return { controller, view, target, onPromote, onEdit, onActionFailed, getStore: () => store };
}

function summaryValues(target: HTMLElement): string[] {
    return Array.from(target.querySelectorAll(".ticktick-task-center__inbox-summary-item"))
        .map((item) => item.textContent ?? "");
}

function itemIds(target: HTMLElement, tier: string): string[] {
    return Array.from(
        target.querySelectorAll<HTMLElement>(`.ticktick-task-center__inbox-item[data-tier="${tier}"]`),
    ).map((item) => item.dataset.noteId ?? "");
}

function actionLabels(item: Element): string[] {
    return Array.from(item.querySelectorAll(".ticktick-task-center__inbox-action"))
        .map((button) => button.textContent ?? "");
}

beforeEach(() => {
    document.body.replaceChildren();
});

describe("InboxView 结构", () => {
    it("把便条按两级分开，最新的在最上面", async () => {
        const { controller, target } = setup([
            note("a", "较早的快速事项", "quick", YESTERDAY),
            note("b", "较新的快速事项", "quick", TODAY),
            note("c", "正式任务", "formal", TODAY),
        ]);
        await controller.start();

        expect(itemIds(target, "quick")).toEqual(["b", "a"]);
        expect(itemIds(target, "formal")).toEqual(["c"]);
    });

    it("快速事项有「完成」，正式任务没有", async () => {
        const { controller, target } = setup([
            note("a", "帮师兄找份观测记录", "quick", TODAY),
            note("b", "给 GRB 写一段可复现的说明", "formal", TODAY),
        ]);
        await controller.start();

        const quick = target.querySelector('[data-note-id="a"]')!;
        const formal = target.querySelector('[data-note-id="b"]')!;
        // 位置固定：完成（仅快速事项）→ 移入任务清单 → 编辑 → 删除
        expect(actionLabels(quick)).toEqual(["✓ 完成", "→ 移入任务清单", "编辑", "🗑"]);
        expect(actionLabels(formal)).toEqual(["→ 移入任务清单", "编辑", "🗑"]);
        expect(quick.querySelector(".ticktick-task-center__inbox-action--primary")?.textContent)
            .toBe("✓ 完成");
        expect(formal.querySelector(".ticktick-task-center__inbox-action--primary")?.textContent)
            .toBe("→ 移入任务清单");
    });

    it("两张便条的「编辑」都把对应便条交给插件层", async () => {
        const { controller, target, onEdit } = setup([
            note("a", "帮师兄找份观测记录", "quick", TODAY),
            note("b", "给 GRB 写一段可复现的说明", "formal", TODAY),
        ]);
        await controller.start();

        for (const noteId of ["a", "b"]) {
            const edit = Array.from(
                target.querySelectorAll<HTMLButtonElement>(`[data-note-id="${noteId}"] .ticktick-task-center__inbox-action`),
            ).find((button) => button.textContent === "编辑");
            expect(edit).toBeDefined();
            edit!.click();
        }

        expect(onEdit).toHaveBeenCalledTimes(2);
        expect(onEdit.mock.calls[0]?.[0]).toMatchObject({ id: "a", text: "帮师兄找份观测记录" });
        expect(onEdit.mock.calls[1]?.[0]).toMatchObject({ id: "b", text: "给 GRB 写一段可复现的说明" });
    });

    it("汇总条把待处理与今日完成分开计数", async () => {
        const { controller, target } = setup([
            note("a", "待办一", "quick", TODAY),
            note("b", "待办二", "formal", TODAY),
            note("d", "今天划掉的", "quick", TODAY, TODAY),
        ]);
        await controller.start();

        expect(summaryValues(target)).toEqual([
            "待处理 2",
            "⚡ 快速事项 1",
            "🔬 正式任务 1",
            "✓ 今日已完成 1",
        ]);
    });
});

describe("InboxView 捕获", () => {
    function captureFields(target: HTMLElement) {
        return {
            title: target.querySelector<HTMLInputElement>(".ticktick-task-center__inbox-title-input")!,
            body: target.querySelector<HTMLTextAreaElement>(".ticktick-task-center__inbox-input")!,
        };
    }

    it("标题回车记一笔并清空两个框", async () => {
        const { controller, target, getStore } = setup();
        await controller.start();

        const { title } = captureFields(target);
        title.value = "订 11 月会议期间住的酒店";
        title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await vi.waitFor(() => expect(getStore().notes).toHaveLength(1));

        expect(getStore().notes[0]?.text).toBe("订 11 月会议期间住的酒店");
        expect(getStore().notes[0]?.tier).toBe("quick");
        expect(title.value).toBe("");
    });

    it("标题 + 正文拼成一份文字，中间留空行", async () => {
        const { controller, target, getStore } = setup();
        await controller.start();

        const { title, body } = captureFields(target);
        title.value = "Abstracts for Oct 20 From Don";
        body.value = "PAARE Colleagues,\n\nPlease get these to me soon.";
        title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await vi.waitFor(() => expect(getStore().notes).toHaveLength(1));

        expect(getStore().notes[0]?.text)
            .toBe("Abstracts for Oct 20 From Don\n\nPAARE Colleagues,\n\nPlease get these to me soon.");
        expect(body.value).toBe("");
    });

    it("正文里回车不提交（留给换行），⌘/Ctrl+回车才提交", async () => {
        const { controller, target, getStore } = setup();
        await controller.start();

        const { title, body } = captureFields(target);
        title.value = "标题";
        body.value = "第一行";
        body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await Promise.resolve();
        expect(getStore().notes).toEqual([]);

        body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
        await vi.waitFor(() => expect(getStore().notes).toHaveLength(1));
        expect(getStore().notes[0]?.text).toBe("标题\n\n第一行");
    });

    it("切到正式任务后记下的便条属于正式任务", async () => {
        const { controller, target, getStore } = setup();
        await controller.start();

        target.querySelector<HTMLButtonElement>('[data-tier="formal"]')!.click();
        const { title } = captureFields(target);
        title.value = "写 GRB 的样本筛选说明";
        title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await vi.waitFor(() => expect(getStore().notes).toHaveLength(1));

        expect(getStore().notes[0]?.tier).toBe("formal");
    });

    it("只有正文、没有标题时不写入——否则会存下一张没有标题的便条", async () => {
        const { controller, target, onActionFailed, getStore } = setup();
        await controller.start();

        const { body } = captureFields(target);
        body.value = "只有正文";
        const form = target.querySelector<HTMLFormElement>(".ticktick-task-center__inbox-capture")!;
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(onActionFailed).toHaveBeenCalledWith("title-required");
        expect(getStore().notes).toEqual([]);
    });

    it("完全空着提交也给出提示", async () => {
        const { controller, target, onActionFailed, getStore } = setup();
        await controller.start();

        const form = target.querySelector<HTMLFormElement>(".ticktick-task-center__inbox-capture")!;
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(onActionFailed).toHaveBeenCalledWith("title-required");
        expect(getStore().notes).toEqual([]);
    });
});

describe("InboxView 记一笔预览", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    function previewParts(target: HTMLElement) {
        return {
            toggle: target.querySelector<HTMLButtonElement>(".ticktick-task-center__inbox-preview-toggle")!,
            host: target.querySelector<HTMLElement>(".ticktick-task-center__inbox-preview-host")!,
            body: target.querySelector<HTMLTextAreaElement>(".ticktick-task-center__inbox-input")!,
        };
    }

    it("默认收起，不渲染预览", async () => {
        const { controller, target } = setup();
        await controller.start();

        const { toggle, host } = previewParts(target);
        expect(toggle.textContent).toBe("显示预览");
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        expect(host.childElementCount).toBe(0);
    });

    it("展开后渲染正文的 Markdown，再点收起", async () => {
        const { controller, target } = setup();
        await controller.start();

        const { toggle, body } = previewParts(target);
        body.value = "**加粗**\n\n> 引用\n\n- 甲\n- 乙";
        toggle.click();

        expect(toggle.textContent).toBe("隐藏预览");
        expect(toggle.getAttribute("aria-pressed")).toBe("true");
        const preview = target.querySelector<HTMLElement>(".ticktick-task-center__inbox-preview")!;
        expect(preview.getAttribute("aria-hidden")).toBe("true");
        expect(preview.querySelector("strong")?.textContent).toBe("加粗");
        expect(preview.querySelector("blockquote")?.textContent).toContain("引用");
        expect(preview.querySelectorAll("li")).toHaveLength(2);

        toggle.click();
        expect(toggle.textContent).toBe("显示预览");
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        expect(target.querySelector(".ticktick-task-center__inbox-preview")).toBeNull();
    });

    it("正文为空时只显示提示，不画空面板", async () => {
        const { controller, target } = setup();
        await controller.start();

        previewParts(target).toggle.click();

        expect(target.querySelector(".ticktick-task-center__inbox-preview")).toBeNull();
        expect(target.querySelector(".ticktick-task-center__inbox-preview-hint")?.textContent)
            .toBe("正文为空，列表里只显示标题。");
    });

    it("展开时输入正文，200ms 后预览更新", async () => {
        const { controller, target } = setup();
        await controller.start();
        vi.useFakeTimers();

        const { toggle, body } = previewParts(target);
        body.value = "第一版";
        toggle.click();
        expect(target.querySelector(".ticktick-task-center__inbox-preview-body")?.textContent)
            .toContain("第一版");

        body.value = "第二版 **加粗**";
        body.dispatchEvent(new Event("input", { bubbles: true }));
        expect(target.querySelector(".ticktick-task-center__inbox-preview-body")?.textContent)
            .not.toContain("第二版");

        vi.advanceTimersByTime(199);
        expect(target.querySelector(".ticktick-task-center__inbox-preview-body")?.textContent)
            .not.toContain("第二版");

        vi.advanceTimersByTime(1);
        const updated = target.querySelector(".ticktick-task-center__inbox-preview-body")!;
        expect(updated.textContent).toContain("第二版");
        expect(updated.querySelector("strong")?.textContent).toBe("加粗");
    });

    it("提交成功后清空并收起预览", async () => {
        const { controller, target, getStore } = setup();
        await controller.start();

        const { toggle, body } = previewParts(target);
        const title = target.querySelector<HTMLInputElement>(".ticktick-task-center__inbox-title-input")!;
        title.value = "标题";
        body.value = "**正文**";
        toggle.click();
        expect(target.querySelector(".ticktick-task-center__inbox-preview")).not.toBeNull();

        title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await vi.waitFor(() => expect(getStore().notes).toHaveLength(1));

        expect(title.value).toBe("");
        expect(body.value).toBe("");
        expect(toggle.textContent).toBe("显示预览");
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        expect(target.querySelector(".ticktick-task-center__inbox-preview")).toBeNull();
    });

    it("提交失败保留预览", async () => {
        const { controller, target, onActionFailed, getStore } = setup();
        await controller.start();

        const { toggle, body } = previewParts(target);
        body.value = "**正文**";
        toggle.click();
        const form = target.querySelector<HTMLFormElement>(".ticktick-task-center__inbox-capture")!;
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(onActionFailed).toHaveBeenCalledWith("title-required");
        expect(getStore().notes).toEqual([]);
        expect(toggle.textContent).toBe("隐藏预览");
        expect(target.querySelector(".ticktick-task-center__inbox-preview")).not.toBeNull();
    });
});

describe("InboxView 动作", () => {
    it("完成的便条离开待处理并进入今日已完成", async () => {
        const { controller, target } = setup([note("a", "交工位费", "quick", TODAY)]);
        await controller.start();

        target.querySelector<HTMLButtonElement>('[data-note-id="a"] .ticktick-task-center__inbox-action--primary')!
            .click();
        await vi.waitFor(() => expect(
            target.querySelector(".ticktick-task-center__inbox-done"),
        ).not.toBeNull());

        expect(itemIds(target, "quick")).toEqual([]);
        const done = target.querySelector(".ticktick-task-center__inbox-done")!;
        expect(done.querySelector("summary")?.textContent).toContain("今日已完成 1");
        expect(done.querySelector("summary")?.textContent).toContain("不计入任务统计");
        // 已完成只是划掉的记录，没有编辑入口
        expect(done.querySelector(".ticktick-task-center__inbox-action")).toBeNull();
        expect(done.textContent).not.toContain("编辑");
    });

    it("改级把便条换到另一组", async () => {
        const { controller, target } = setup([note("a", "顺手找份文件", "quick", TODAY)]);
        await controller.start();

        target.querySelector<HTMLButtonElement>('[data-note-id="a"] .ticktick-task-center__inbox-retier')!
            .click();
        await vi.waitFor(() => expect(itemIds(target, "formal")).toEqual(["a"]));

        expect(itemIds(target, "quick")).toEqual([]);
    });

    it("移入任务清单只请求弹窗，不在视图里建任务", async () => {
        const { controller, target, onPromote } = setup([note("a", "给 GRB 写说明", "formal", TODAY)]);
        await controller.start();

        target.querySelector<HTMLButtonElement>('[data-note-id="a"] .ticktick-task-center__inbox-action--primary')!
            .click();

        expect(onPromote).toHaveBeenCalledTimes(1);
        expect(onPromote.mock.calls[0]?.[0]).toMatchObject({ id: "a" });
    });

    it("删除便条后它从列表消失", async () => {
        const { controller, target, getStore } = setup([note("a", "回邮件", "quick", TODAY)]);
        await controller.start();

        target.querySelector<HTMLButtonElement>('[data-note-id="a"] .ticktick-task-center__inbox-action--icon')!
            .click();
        await vi.waitFor(() => expect(getStore().notes).toEqual([]));
    });
});

describe("InboxView 状态", () => {
    it("空收件箱显示空状态", async () => {
        const { controller, target } = setup();
        await controller.start();

        expect(target.querySelector(".ticktick-task-center__inbox-state")?.textContent)
            .toBe("收件箱是空的。");
    });

    it("加载失败显示错误与重试", async () => {
        const { controller, target } = setup([], { loadError: true });
        await controller.start();

        const state = target.querySelector(".ticktick-task-center__inbox-state--error")!;
        expect(state.textContent).toContain("无法加载收件箱。");
        expect(state.querySelector(".ticktick-task-center__inbox-retry")?.textContent).toBe("重试");
    });

    it("只有今日已完成时仍展示折叠区，而不是空状态", async () => {
        const { controller, target } = setup([note("a", "今天划掉的", "quick", TODAY, TODAY)]);
        await controller.start();

        expect(target.querySelector(".ticktick-task-center__inbox-done")).not.toBeNull();
        expect(target.querySelector(".ticktick-task-center__inbox-state")).toBeNull();
    });

    it("中英文切换后文案跟着变", async () => {
        const englishTarget = document.createElement("div");
        document.body.append(englishTarget);
        const controller = new InboxController({
            load: async () => ({ store: { version: INBOX_STORE_VERSION, notes: [] }, droppedNoteCount: 0 }),
            save: async () => undefined,
            now: () => TODAY,
        });
        const view = new InboxView(englishTarget, {
            controller,
            translate: ((key: string) => key) as Translate,
            onPromote: vi.fn(),
            onEdit: vi.fn(),
            onActionFailed: vi.fn(),
        });
        await controller.start();

        expect(englishTarget.querySelector(".ticktick-task-center__inbox-state")?.textContent)
            .toBe("inbox.empty");
        view.destroy();
    });
});


describe("InboxView 标题与正文", () => {
    const LONG_BODY = "PAARE Colleagues,\n\nI have abstracts and titles from Ms. Ford、Bruce 和 Brice at UVI.\n\nPlease get these to me soon so I can put together a schedule for Oct 20.";

    it("第一段是标题，其余正文分开渲染", async () => {
        const { controller, target } = setup([
            note("a", `Abstracts for Oct 20 From Don\n\n${LONG_BODY}`, "formal", TODAY),
        ]);
        await controller.start();

        const item = target.querySelector('[data-note-id="a"]')!;
        expect(item.querySelector(".ticktick-task-center__inbox-item-text")?.textContent)
            .toBe("Abstracts for Oct 20 From Don");
        const body = item.querySelector(".ticktick-task-center__inbox-item-body-text")!;
        expect(body.querySelectorAll("p").length).toBeGreaterThan(1);
        expect(body.textContent).toContain("PAARE Colleagues");
    });

    it("正文默认折叠", async () => {
        const { controller, target } = setup([
            note("a", `标题\n\n${LONG_BODY}`, "formal", TODAY),
        ]);
        await controller.start();

        expect(target.querySelector(".ticktick-task-center__inbox-item-body-text")?.getAttribute("data-collapsed"))
            .toBe("true");
    });

    it("正文里的基础 Markdown 生效", async () => {
        const { controller, target } = setup([
            note("a", "标题\n\n看 **这里** 与 `code`\n\n- 甲\n- 乙", "formal", TODAY),
        ]);
        await controller.start();

        const body = target.querySelector(".ticktick-task-center__inbox-item-body-text")!;
        expect(body.querySelector("strong")?.textContent).toBe("这里");
        expect(body.querySelector("code")?.textContent).toBe("code");
        expect(body.querySelectorAll("li")).toHaveLength(2);
    });

    it("只有标题的便条不渲染正文，也没有展开按钮", async () => {
        const { controller, target } = setup([note("a", "订 11 月会议期间住的酒店", "quick", TODAY)]);
        await controller.start();

        const item = target.querySelector('[data-note-id="a"]')!;
        expect(item.querySelector(".ticktick-task-center__inbox-item-body-text")).toBeNull();
        expect(item.querySelector(".ticktick-task-center__inbox-body-toggle")).toBeNull();
    });
});

describe("InboxView 正文折叠开关", () => {
    // jsdom 没有布局，scrollHeight 恒为 0；换成可控实现才能复现"放不下"的情形
    const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const originalClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    let overflow = false;

    beforeEach(() => {
        overflow = false;
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
            configurable: true,
            get(this: HTMLElement) {
                return overflow && this.classList.contains("ticktick-task-center__inbox-item-body-text")
                    ? 200
                    : 0;
            },
        });
        Object.defineProperty(HTMLElement.prototype, "clientHeight", {
            configurable: true,
            get() {
                return 40;
            },
        });
    });

    afterEach(() => {
        if (originalScroll) {
            Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScroll);
        }
        if (originalClient) {
            Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClient);
        }
    });

    it("放得下时不出现展开按钮", async () => {
        overflow = false;
        const { controller, target } = setup([note("a", "标题\n\n短正文", "formal", TODAY)]);
        await controller.start();

        expect(target.querySelector<HTMLElement>(".ticktick-task-center__inbox-body-toggle")!
            .classList.contains("fn__none")).toBe(true);
    });

    it("放不下时出现「展开正文」，点开后可再收起", async () => {
        overflow = true;
        const { controller, target } = setup([
            note("a", "标题\n\n第一段\n\n第二段\n\n第三段\n\n第四段", "formal", TODAY),
        ]);
        await controller.start();

        const toggle = target.querySelector<HTMLButtonElement>(".ticktick-task-center__inbox-body-toggle")!;
        expect(toggle.classList.contains("fn__none")).toBe(false);
        expect(toggle.textContent).toBe("展开正文 ▾");

        toggle.click();
        await vi.waitFor(() => expect(
            target.querySelector(".ticktick-task-center__inbox-item-body-text")?.getAttribute("data-collapsed"),
        ).toBe("false"));
        expect(target.querySelector(".ticktick-task-center__inbox-body-toggle")?.textContent)
            .toBe("收起正文 ▴");

        target.querySelector<HTMLButtonElement>(".ticktick-task-center__inbox-body-toggle")!.click();
        await vi.waitFor(() => expect(
            target.querySelector(".ticktick-task-center__inbox-item-body-text")?.getAttribute("data-collapsed"),
        ).toBe("true"));
        // 展开再收起后按钮仍在，否则就没法再展开了
        expect(target.querySelector<HTMLElement>(".ticktick-task-center__inbox-body-toggle")!
            .classList.contains("fn__none")).toBe(false);
    });
});
