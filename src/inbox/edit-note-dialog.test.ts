// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import { showMessageCalls } from "../test/siyuan";
import { showEditInboxNoteDialog } from "./edit-note-dialog";
import type { InboxActionResult } from "./inbox-controller";
import type { InboxNote, InboxNoteTier } from "./inbox-note";

const NOTE: InboxNote = {
    id: "note-1",
    text: "旧标题\n\n旧正文第一段\n\n- 列表一\n- 列表二",
    tier: "quick",
    createdAt: "2026-10-18T10:24:00-04:00",
};

const translate = ((key: string) => ({
    "inbox.editTitle": "编辑便条",
    "inbox.recordedAt": "记录于",
    "inbox.titleLabel": "标题",
    "inbox.bodyLabel": "正文（可选）",
    "inbox.titlePlaceholder": "要做什么？",
    "inbox.bodyPlaceholder": "正文：背景、前因后果",
    "inbox.tierGroupLabel": "条目分级",
    "inbox.tierQuick": "⚡ 快速事项",
    "inbox.tierFormal": "🔬 正式任务",
    "inbox.saveChanges": "保存修改",
    "inbox.saving": "保存中…",
    "inbox.editSaved": "已更新",
    "inbox.preview": "预览",
    "inbox.previewHint": "实时 · 与列表一致",
    "inbox.hidePreview": "隐藏预览",
    "inbox.showPreview": "显示预览",
    "inbox.previewEmpty": "正文为空，列表里只显示标题。",
    "inbox.errors.title-required": "请输入标题。",
    "inbox.errors.text-too-long": "内容太长，请精简到 2000 字以内。",
    "inbox.errors.note-not-found": "这张便条已不存在，请刷新。",
    "inbox.errors.save-failed": "保存失败，便条没有变化，请重试。",
    "common.cancel": "取消",
}[key] ?? key)) as Translate;

function setup(options: {
    note?: InboxNote;
    onSave?: (text: string, tier: InboxNoteTier) => Promise<InboxActionResult>;
} = {}) {
    const onSave = vi.fn(options.onSave ?? (async () => ({ ok: true })));
    const dialog = showEditInboxNoteDialog({
        translate,
        note: options.note ?? NOTE,
        locale: "zh-CN",
        onSave: onSave as never,
    });
    const form = dialog.element.querySelector<HTMLFormElement>(".ticktick-inbox-edit")!;
    return {
        dialog,
        form,
        onSave,
        title: form.querySelector<HTMLInputElement>('[data-field="title"]')!,
        body: form.querySelector<HTMLTextAreaElement>('[data-field="body"]')!,
        tier: form.querySelector<HTMLInputElement>('[data-field="tier"]')!,
        error: form.querySelector<HTMLElement>('[data-field="error"]')!,
        recordedAt: form.querySelector<HTMLTimeElement>('[data-field="recorded-at"]')!,
        cancelButton: form.querySelector<HTMLButtonElement>('[data-action="cancel"]')!,
        saveButton: form.querySelector<HTMLButtonElement>('[data-action="save"]')!,
        preview: form.querySelector<HTMLElement>('[data-field="preview"]')!,
        previewToggle: form.querySelector<HTMLButtonElement>('[data-action="toggle-preview"]')!,
    };
}

function pressEnter(element: HTMLElement, init: KeyboardEventInit = {}): void {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...init }));
}

beforeEach(() => {
    document.body.replaceChildren();
    showMessageCalls.length = 0;
});

describe("编辑便条弹窗", () => {
    it("打开时按「第一段是标题、其余是正文」预填，并显示记录时间", () => {
        const { title, body, tier, recordedAt, saveButton, cancelButton } = setup();

        expect(title.value).toBe("旧标题");
        expect(body.value).toBe("旧正文第一段\n\n- 列表一\n- 列表二");
        expect(tier.value).toBe("quick");
        expect(recordedAt.dateTime).toBe(NOTE.createdAt);
        expect(recordedAt.textContent).not.toBe("");
        expect(saveButton.textContent).toBe("保存修改");
        expect(cancelButton.textContent).toBe("取消");
    });

    it("焦点在标题末尾，方便接着改而不是整段重写", () => {
        const { title } = setup();

        expect(document.activeElement).toBe(title);
        expect(title.selectionStart).toBe("旧标题".length);
        expect(title.selectionEnd).toBe("旧标题".length);
    });

    it("标题回车保存：拼回一段文字，关闭弹窗并提示已更新", async () => {
        const { dialog, title, body, onSave } = setup();
        title.value = "  新标题  ";
        body.value = "  新正文  ";

        pressEnter(title);

        await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave).toHaveBeenCalledWith("新标题\n\n新正文", "quick");
        await vi.waitFor(() => expect(dialog.element.isConnected).toBe(false));
        expect(showMessageCalls.at(-1)?.[0]).toBe("已更新");
    });

    it("正文里回车不提交，⌘/Ctrl+回车才提交", async () => {
        const { body, onSave } = setup();
        body.value = "第一行";

        pressEnter(body);
        await Promise.resolve();
        expect(onSave).not.toHaveBeenCalled();

        pressEnter(body, { metaKey: true });
        await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    });

    it("改分级后保存，按新的分级提交", async () => {
        const { form, title, tier, onSave } = setup();
        form.querySelector<HTMLButtonElement>('[data-value="formal"]')!.click();
        expect(tier.value).toBe("formal");

        pressEnter(title);

        await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0]?.[1]).toBe("formal");
    });

    it("标题为空时不保存、不关闭，并给出提示", async () => {
        const { dialog, title, error, onSave } = setup();
        title.value = "   ";

        pressEnter(title);

        await vi.waitFor(() => expect(error.textContent).toBe("请输入标题。"));
        expect(error.classList.contains("fn__none")).toBe(false);
        expect(onSave).not.toHaveBeenCalled();
        expect(dialog.element.isConnected).toBe(true);
    });

    it("内容超过 2000 字时只在弹窗里提示，不发保存请求，输入不丢", async () => {
        const { dialog, body, error, onSave } = setup();
        body.value = "a".repeat(2001);

        pressEnter(body, { ctrlKey: true });

        await vi.waitFor(() => expect(error.textContent).toBe("内容太长，请精简到 2000 字以内。"));
        expect(onSave).not.toHaveBeenCalled();
        expect(dialog.element.isConnected).toBe(true);
        expect(body.value).toHaveLength(2001);
    });

    it("写盘失败时弹窗保持打开、内容不变，并提示重试", async () => {
        const { dialog, title, body, error, onSave } = setup({
            onSave: async () => ({ ok: false, reason: "save-failed" }),
        });
        title.value = "新标题";
        body.value = "新正文";

        pressEnter(title);

        await vi.waitFor(() => expect(error.textContent).toBe("保存失败，便条没有变化，请重试。"));
        expect(dialog.element.isConnected).toBe(true);
        expect(title.value).toBe("新标题");
        expect(body.value).toBe("新正文");
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("便条已被移入任务清单或删除时，提示不存在且不覆盖任何内容", async () => {
        const { dialog, title, error } = setup({
            onSave: async () => ({ ok: false, reason: "note-not-found" }),
        });

        pressEnter(title);

        await vi.waitFor(() => expect(error.textContent).toBe("这张便条已不存在，请刷新。"));
        expect(dialog.element.isConnected).toBe(true);
    });

    it("保存中锁住输入和按钮，不会重复提交", async () => {
        let finish!: (result: InboxActionResult) => void;
        const onSave = vi.fn(() => new Promise<InboxActionResult>((resolve) => {
            finish = resolve;
        }));
        const { dialog, title, body, saveButton, cancelButton } = setup({ onSave });

        pressEnter(title);
        await Promise.resolve();

        expect(saveButton.disabled).toBe(true);
        expect(saveButton.textContent).toBe("保存中…");
        expect(title.disabled).toBe(true);
        expect(body.disabled).toBe(true);
        expect(cancelButton.disabled).toBe(true);

        pressEnter(title);
        await Promise.resolve();
        expect(onSave).toHaveBeenCalledTimes(1);

        finish({ ok: true });
        await vi.waitFor(() => expect(dialog.element.isConnected).toBe(false));
    });

    it("打开时把正文渲染成只读预览，保存的仍是原始 Markdown", async () => {
        const note: InboxNote = {
            ...NOTE,
            text: "旧标题\n\n**加粗** 与 `code`\n\n- 列表一\n- 列表二",
        };
        const { dialog, title, preview, onSave } = setup({ note });

        expect(preview.querySelector(".ticktick-inbox-edit__preview")?.getAttribute("aria-hidden")).toBe("true");
        expect(preview.querySelector("strong")?.textContent).toBe("加粗");
        expect(preview.querySelector("code")?.textContent).toBe("code");
        expect(preview.querySelectorAll("li")).toHaveLength(2);

        pressEnter(title);

        await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0]?.[0]).toBe("旧标题\n\n**加粗** 与 `code`\n\n- 列表一\n- 列表二");
        await vi.waitFor(() => expect(dialog.element.isConnected).toBe(false));
    });

    it("预览可以折叠，折叠后只留输入框，再展开恢复", () => {
        const { preview, previewToggle } = setup();

        expect(preview.querySelector(".ticktick-inbox-edit__preview")).not.toBeNull();
        expect(previewToggle.textContent).toBe("隐藏预览");
        expect(previewToggle.getAttribute("aria-pressed")).toBe("true");

        previewToggle.click();

        expect(preview.children).toHaveLength(0);
        expect(previewToggle.textContent).toBe("显示预览");
        expect(previewToggle.getAttribute("aria-pressed")).toBe("false");

        previewToggle.click();

        expect(preview.querySelector(".ticktick-inbox-edit__preview")).not.toBeNull();
        expect(preview.querySelectorAll("li")).toHaveLength(2);
    });

    it("正文清空后不显示空预览框，只留一行提示", () => {
        vi.useFakeTimers();
        try {
            const { body, preview } = setup();

            body.value = "";
            body.dispatchEvent(new Event("input"));
            vi.advanceTimersByTime(250);

            expect(preview.querySelector(".ticktick-inbox-edit__preview")).toBeNull();
            expect(preview.querySelector(".ticktick-inbox-edit__preview-hint")?.textContent)
                .toBe("正文为空，列表里只显示标题。");
        } finally {
            vi.useRealTimers();
        }
    });

    it("预览在停止输入 250ms 后才更新，打字过程中不动", () => {
        vi.useFakeTimers();
        try {
            const { body, preview } = setup();

            body.value = "**新内容**";
            body.dispatchEvent(new Event("input"));
            vi.advanceTimersByTime(200);

            expect(preview.textContent).not.toContain("新内容");

            vi.advanceTimersByTime(60);

            expect(preview.querySelector("strong")?.textContent).toBe("新内容");
        } finally {
            vi.useRealTimers();
        }
    });

    it("弹窗关闭后不再刷新预览", () => {
        vi.useFakeTimers();
        try {
            const { dialog, body, preview } = setup();

            body.value = "**关闭后**";
            body.dispatchEvent(new Event("input"));
            dialog.destroy();

            expect(() => vi.advanceTimersByTime(300)).not.toThrow();
            expect(preview.textContent).not.toContain("关闭后");
        } finally {
            vi.useRealTimers();
        }
    });

    it("取消关闭弹窗，不保存任何修改", () => {
        const { dialog, cancelButton, onSave } = setup();

        cancelButton.click();

        expect(dialog.element.isConnected).toBe(false);
        expect(onSave).not.toHaveBeenCalled();
    });
});
