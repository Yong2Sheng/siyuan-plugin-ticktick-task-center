// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import { PromoteTaskError } from "../inbox/promote";
import type { InboxNote } from "../inbox/inbox-note";
import { showCreateTaskDialog } from "./task-form";

const translate = ((key: string) => ({
    "taskCreate.dialogTitle": "创建任务",
    "taskCreate.titleLabel": "任务标题",
    "taskCreate.urlLabel": "任务链接（可选）",
    "taskCreate.statusLabel": "任务状态",
    "taskCreate.workModeLabel": "工作分类",
    "taskCreate.deadlineLabel": "截止日期（可选）",
    "taskCreate.create": "创建",
    "taskCreate.creating": "创建中…",
    "taskCreate.created": "任务已创建",
    "taskCreate.errors.createFailed": "任务创建失败。",
    "taskCreate.errors.insertFailed": "插入任务块失败。",
    "taskCreate.errors.attributeWriteFailed": "写入任务属性失败。",
    "taskCreate.errors.rollbackFailed": "回滚失败 ${blockId}",
    "validation.titleRequired": "请输入任务名称。",
    "validation.urlInvalid": "请输入格式合法的任务链接。",
    "validation.urlProtocolUnsupported": "仅支持 HTTPS 链接或思源块链接。",
    "validation.urlCredentialsUnsupported": "不支持包含用户名或密码的链接。",
    "validation.urlSiYuanInvalid": "思源链接必须为 siyuan://blocks/<合法块 ID>。",
    "validation.statusInvalid": "任务状态无效。",
    "validation.workModeInvalid": "请选择工作分类。",
    "validation.deadlineInvalid": "截止日期无效。",
    "status.todo": "待开始",
    "status.inProgress": "进行中",
    "status.waiting": "等待回复",
    "status.blocked": "已阻塞",
    "status.completed": "已完成",
    "status.failed": "已失败",
    "status.cancelled": "已取消",
    "workMode.explore": "探索-Explore",
    "workMode.build": "构建-Build",
    "workMode.execute": "执行-Execute",
    "workMode.review": "评审-Review",
    "common.cancel": "取消",
    "inboxBringIn.summary": "📥 从收件箱带入（${count} 条正式任务）",
    "inboxBringIn.chip": "📥 来自收件箱",
    "inboxPromote.errors.task-create-failed": "创建任务块失败，便条未改动。",
    "inboxPromote.errors.note-body-failed": "任务已创建，但便条正文写入失败；便条已保留，请手动处理。",
    "inboxPromote.errors.note-remove-failed": "任务已创建，但收件箱便条未能删除，请手动处理。",
}[key] ?? key)) as Translate;

const FORMAL_NOTE: InboxNote = {
    id: "note-1",
    text: "给 GRB 那篇的样本筛选写一段可复现的说明\n\n背景：审稿人要求补一段可复现的样本筛选说明。",
    tier: "formal",
    createdAt: "2026-10-11T15:10:00.000Z",
};

const FORMAL_NOTE_TITLE = "给 GRB 那篇的样本筛选写一段可复现的说明";

function setup(options: {
    inboxNotes?: readonly InboxNote[];
    onCreate?: (task: unknown, noteId?: string) => Promise<void>;
} = {}) {
    const onCreate = vi.fn(options.onCreate ?? (async () => undefined));
    const dialog = showCreateTaskDialog({
        translate,
        initialTitle: "当前文档标题",
        ...(options.inboxNotes ? { inboxNotes: options.inboxNotes } : {}),
        onCreate: onCreate as never,
    });
    const form = dialog.element.querySelector<HTMLFormElement>(".ticktick-task-form")!;
    return { dialog, form, onCreate };
}

function submit(form: HTMLFormElement): void {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

beforeEach(() => {
    document.body.replaceChildren();
});

describe("创建任务弹窗里的收件箱带入", () => {
    it("没有便条时不显示带入入口", () => {
        const { dialog } = setup();
        const details = dialog.element.querySelector<HTMLDetailsElement>('[data-field="inbox"]')!;
        expect(details.classList.contains("fn__none")).toBe(true);
    });

    it("有便条时显示数量，但默认收起", () => {
        const { dialog } = setup({ inboxNotes: [FORMAL_NOTE] });
        const details = dialog.element.querySelector<HTMLDetailsElement>('[data-field="inbox"]')!;
        expect(details.classList.contains("fn__none")).toBe(false);
        expect(details.open).toBe(false);
        expect(details.querySelector("summary")?.textContent)
            .toBe("📥 从收件箱带入（1 条正式任务）");
    });

    it("选一条便条会填进标题并显示来源标记", () => {
        const { dialog } = setup({ inboxNotes: [FORMAL_NOTE] });
        const title = dialog.element.querySelector<HTMLInputElement>('[data-field="title"]')!;
        expect(title.value).toBe("当前文档标题");

        dialog.element.querySelector<HTMLButtonElement>(".ticktick-task-form__inbox-item")!.click();

        expect(title.value).toBe(FORMAL_NOTE_TITLE);
        const chip = dialog.element.querySelector<HTMLElement>('[data-field="inbox-chip"]')!;
        expect(chip.classList.contains("fn__none")).toBe(false);
        expect(chip.textContent).toBe("📥 来自收件箱");
    });

    it("提交时把便条 id 交给调用方，由它先建块再删便条", async () => {
        const { form, onCreate } = setup({ inboxNotes: [FORMAL_NOTE] });
        form.querySelector<HTMLButtonElement>(".ticktick-task-form__inbox-item")!.click();
        form.querySelector<HTMLInputElement>('[data-field="status"]')!.value = "in-progress";
        form.querySelector<HTMLInputElement>('[data-field="work-mode"]')!.value = "execute";

        submit(form);
        await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));

        expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ title: FORMAL_NOTE_TITLE, url: "" });
        expect(onCreate.mock.calls[0]?.[1]).toBe("note-1");
    });

    it("没选便条时不传 id", async () => {
        const { form, onCreate } = setup({ inboxNotes: [FORMAL_NOTE] });
        form.querySelector<HTMLInputElement>('[data-field="status"]')!.value = "in-progress";
        form.querySelector<HTMLInputElement>('[data-field="work-mode"]')!.value = "execute";

        submit(form);
        await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));

        expect(onCreate.mock.calls[0]?.[1]).toBeUndefined();
    });

    it("便条删除失败时给出专门的提示，不谎报创建失败", async () => {
        const { dialog, form } = setup({
            inboxNotes: [FORMAL_NOTE],
            onCreate: async () => {
                throw new PromoteTaskError("note-remove-failed", "20260101000000-aaaaaaa");
            },
        });
        form.querySelector<HTMLButtonElement>(".ticktick-task-form__inbox-item")!.click();
        form.querySelector<HTMLInputElement>('[data-field="status"]')!.value = "in-progress";
        form.querySelector<HTMLInputElement>('[data-field="work-mode"]')!.value = "execute";

        submit(form);
        await vi.waitFor(() => expect(
            dialog.element.querySelector('[data-field="error"]')?.textContent,
        ).toBe("任务已创建，但收件箱便条未能删除，请手动处理。"));
    });

    it("正文写入失败时给出专门提示，并说明便条已保留", async () => {
        const { dialog, form } = setup({
            inboxNotes: [FORMAL_NOTE],
            onCreate: async () => {
                throw new PromoteTaskError("note-body-failed", "20260101000000-aaaaaaa");
            },
        });
        form.querySelector<HTMLButtonElement>(".ticktick-task-form__inbox-item")!.click();
        form.querySelector<HTMLInputElement>('[data-field="status"]')!.value = "in-progress";
        form.querySelector<HTMLInputElement>('[data-field="work-mode"]')!.value = "execute";

        submit(form);
        await vi.waitFor(() => expect(
            dialog.element.querySelector('[data-field="error"]')?.textContent,
        ).toBe("任务已创建，但便条正文写入失败；便条已保留，请手动处理。"));
    });

    it("任务链接留空也能创建（链接是可选字段）", async () => {
        const { form, onCreate } = setup();
        form.querySelector<HTMLInputElement>('[data-field="title"]')!.value = "写 GRB 的说明";
        form.querySelector<HTMLInputElement>('[data-field="status"]')!.value = "in-progress";
        form.querySelector<HTMLInputElement>('[data-field="work-mode"]')!.value = "execute";

        submit(form);
        await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));

        expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ title: "写 GRB 的说明", url: "" });
    });
});
