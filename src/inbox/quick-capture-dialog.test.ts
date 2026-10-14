// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import { showQuickCaptureDialog } from "./quick-capture-dialog";

const translate = ((key: string) => ({
    "quickCapture.title": "快速记录",
    "quickCapture.save": "记一笔",
    "quickCapture.saveAndContinue": "保存并继续",
    "quickCapture.saved": "已记下",
    "inbox.titleLabel": "标题",
    "inbox.bodyLabel": "正文（可选）",
    "inbox.titlePlaceholder": "要做什么？",
    "inbox.bodyPlaceholder": "正文：背景、前因后果",
    "inbox.tierGroupLabel": "条目分级",
    "inbox.tierQuick": "⚡ 快速事项",
    "inbox.tierFormal": "🔬 正式任务",
    "inbox.errors.title-required": "请输入标题。",
    "inbox.errors.save-failed": "保存失败，便条没有变化，请重试。",
    "common.cancel": "取消",
}[key] ?? key)) as Translate;

function setup(options: {
    initialTier?: "quick" | "formal";
    onCapture?: (text: string, tier: string) => Promise<{ ok: boolean; reason?: string }>;
} = {}) {
    const onCapture = vi.fn(options.onCapture ?? (async () => ({ ok: true })));
    const dialog = showQuickCaptureDialog({
        translate,
        ...(options.initialTier ? { initialTier: options.initialTier } : {}),
        onCapture: onCapture as never,
    });
    const form = dialog.element.querySelector<HTMLFormElement>(".ticktick-quick-capture")!;
    return {
        dialog,
        form,
        onCapture,
        title: form.querySelector<HTMLInputElement>('[data-field="title"]')!,
        body: form.querySelector<HTMLTextAreaElement>('[data-field="body"]')!,
        tier: form.querySelector<HTMLInputElement>('[data-field="tier"]')!,
        error: form.querySelector<HTMLElement>('[data-field="error"]')!,
        continueButton: form.querySelector<HTMLButtonElement>('[data-action="continue"]')!,
        saveButton: form.querySelector<HTMLButtonElement>('[data-action="save"]')!,
    };
}

function pressEnter(element: HTMLElement, init: KeyboardEventInit = {}): void {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...init }));
}

beforeEach(() => {
    document.body.replaceChildren();
});

describe("快速记录弹窗", () => {
    it("打开时焦点在标题框，正文留空", () => {
        const { title, body } = setup();
        expect(title.value).toBe("");
        expect(body.value).toBe("");
    });

    it("标题回车：保存并关闭", async () => {
        const { dialog, title, body, onCapture } = setup();
        title.value = "订 11 月会议期间住的酒店";
        body.value = "会议 11/3–11/7";

        pressEnter(title);

        await vi.waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
        expect(onCapture.mock.calls[0]?.[0]).toBe("订 11 月会议期间住的酒店\n\n会议 11/3–11/7");
        await vi.waitFor(() => expect(dialog.element.isConnected).toBe(false));
    });

    it("正文里回车不提交，⌘/Ctrl+回车才提交", async () => {
        const { title, body, onCapture } = setup();
        title.value = "标题";
        body.value = "第一行";

        pressEnter(body);
        await Promise.resolve();
        expect(onCapture).not.toHaveBeenCalled();

        pressEnter(body, { metaKey: true });
        await vi.waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
    });

    it("标题为空时不保存、不关闭，并给出提示", async () => {
        const { dialog, body, onCapture, error } = setup();
        body.value = "只有正文";

        pressEnter(body, { ctrlKey: true });

        await vi.waitFor(() => expect(error.textContent).toBe("请输入标题。"));
        expect(onCapture).not.toHaveBeenCalled();
        expect(dialog.element.isConnected).toBe(true);
    });

    it("「保存并继续」存下但留在弹窗，清空两个框并把焦点放回标题", async () => {
        const { dialog, title, body, continueButton, onCapture } = setup();
        title.value = "灵感一";
        body.value = "细节";

        continueButton.click();

        // 清空发生在保存回调之后的下一个微任务，等到它真的发生再断言
        await vi.waitFor(() => expect(title.value).toBe(""));
        expect(dialog.element.isConnected).toBe(true);
        expect(body.value).toBe("");
        expect(document.activeElement).toBe(title);

        // 可以接着记第二条
        title.value = "灵感二";
        continueButton.click();
        await vi.waitFor(() => expect(onCapture).toHaveBeenCalledTimes(2));
        expect(onCapture.mock.calls[1]?.[0]).toBe("灵感二");
    });

    it("保存失败时显示错误、保持打开，内容不丢", async () => {
        const { dialog, title, error, onCapture } = setup({
            onCapture: async () => ({ ok: false, reason: "save-failed" }),
        });
        title.value = "会失败的便条";

        pressEnter(title);

        await vi.waitFor(() => expect(error.textContent).toBe("保存失败，便条没有变化，请重试。"));
        expect(dialog.element.isConnected).toBe(true);
        expect(title.value).toBe("会失败的便条");
        expect(onCapture).toHaveBeenCalledTimes(1);
    });

    it("把选中的分级一起交出去，并沿用传入的初始分级", async () => {
        const { title, tier, onCapture } = setup({ initialTier: "formal" });
        expect(tier.value).toBe("formal");

        title.value = "正式任务";
        pressEnter(title);
        await vi.waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
        expect(onCapture.mock.calls[0]?.[1]).toBe("formal");
    });
});
