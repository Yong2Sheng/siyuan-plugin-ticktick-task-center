// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import type { InboxNote } from "./inbox-note";
import type { DocumentTarget } from "./document-picker";
import type { PromoteResult } from "./promote";
import { showPromoteInboxNoteDialog } from "./promote-dialog";

const translate = ((key: string) => ({
    "inboxPromote.dialogTitle": "移入任务清单",
    "inboxPromote.noteLabel": "便条",
    "inboxPromote.titleLabel": "任务标题",
    "inboxPromote.targetLabel": "任务放到哪（每次都要选）",
    "inboxPromote.targetPlaceholder": "搜索文档标题…",
    "inboxPromote.treeLabel": "目标位置文档树",
    "inboxPromote.treeNotebookTag": "笔记本",
    "inboxPromote.treeLoading": "正在加载文档……",
    "inboxPromote.searchEmpty": "没有匹配的文档。",
    "inboxPromote.expand": "展开",
    "inboxPromote.collapse": "收起",
    "inboxPromote.nameEmpty": "请输入文档名称。",
    "inboxPromote.nameInvalid": "文档名称不能包含斜杠。",
    "inboxPromote.plannedEmpty": "还没选位置。笔记本＝建在它根下；文档＝建在它下面。",
    "inboxPromote.plannedPrefix": "将创建：",
    "inboxPromote.documentName": "文档名",
    "inboxPromote.pickedParent": "新文档建在它下面",
    "inboxPromote.submit": "移入任务清单",
    "inboxPromote.submitting": "正在移入…",
    "inboxPromote.created": "已移入任务清单",
    "inboxPromote.errors.target-required": "请选择目标位置。",
    "inboxPromote.errors.note-body-failed": "任务已创建，但便条正文写入失败；便条已保留，请手动处理。",
    "inboxPromote.errors.note-missing": "这张便条已不存在，请刷新收件箱。",
    "inboxPromote.errors.document-create-failed": "新建文档失败，便条未改动。",
    "inboxPromote.errors.task-create-failed": "创建任务块失败，便条未改动。",
    "inboxPromote.errors.note-remove-failed": "任务已创建，但收件箱便条未能删除，请手动处理。",
    "taskCreate.statusLabel": "任务状态",
    "taskCreate.workModeLabel": "工作分类",
    "taskCreate.deadlineLabel": "截止日期（可选）",
    "taskCreate.urlLabel": "任务链接（可选）",
    "common.cancel": "取消",
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
    "validation.titleRequired": "请输入任务名称。",
    "validation.urlInvalid": "请输入格式合法的任务链接。",
    "validation.urlProtocolUnsupported": "仅支持 HTTPS 链接或思源块链接。",
    "validation.urlCredentialsUnsupported": "不支持包含用户名或密码的链接。",
    "validation.urlSiYuanInvalid": "思源链接必须为 siyuan://blocks/<合法块 ID>。",
    "validation.statusInvalid": "任务状态无效。",
    "validation.workModeInvalid": "请选择工作分类。",
    "validation.deadlineInvalid": "截止日期无效。",
}[key] ?? key)) as Translate;

const NOTE_TITLE = "给 GRB 那篇的样本筛选写一段可复现的说明";

const NOTE: InboxNote = {
    id: "note-1",
    text: `${NOTE_TITLE}\n\n背景：审稿人要求补一段可复现的样本筛选说明。`,
    tier: "formal",
    createdAt: "2026-10-11T15:10:00.000Z",
};

const NOTEBOOK = { id: "20260101000000-aaaaaaa", name: "Microquasar Candidate" };
const CHILD = {
    id: "20260101000001-bbbbbbb",
    path: "/20260101000001-bbbbbbb.sy",
    title: "Proposals",
    subFileCount: 0,
};

type CreateRequest = {
    target: DocumentTarget;
    task: { title: string; url: string; status: string; workMode: string };
};

function setup(
    onCreate: (request: CreateRequest) => Promise<PromoteResult> = async () => ({
        ok: true,
        blockId: "b",
        noteRemoved: true,
    }),
) {
    const onCreateMock = vi.fn(onCreate);
    const dialog = showPromoteInboxNoteDialog({
        translate,
        note: NOTE,
        pickerApi: {
            listNotebooks: async () => [NOTEBOOK],
            listChildDocuments: async () => [CHILD],
            searchDocuments: async () => [],
        },
        onCreate: onCreateMock,
    });
    const form = dialog.element.querySelector<HTMLFormElement>(".ticktick-inbox-promote")!;
    return { dialog, form, onCreate: onCreateMock };
}

async function selectTarget(form: HTMLFormElement): Promise<void> {
    // 文档树是异步加载的，先等第一行出现
    await vi.waitFor(() => expect(
        form.querySelectorAll(".ticktick-document-picker__row").length,
    ).toBeGreaterThan(0));
    form.querySelector<HTMLButtonElement>(".ticktick-document-picker__twisty")!.click();
    await vi.waitFor(() => expect(
        form.querySelectorAll(".ticktick-document-picker__row").length,
    ).toBe(2));
    // 点一行 = 新任务文档建在它下面
    form.querySelectorAll<HTMLButtonElement>(".ticktick-document-picker__label")[1]!.click();
}

function submit(form: HTMLFormElement): void {
    // 工作分类和新建任务弹窗一样没有默认值，必须由用户选
    const workMode = form.querySelector<HTMLInputElement>('[data-field="work-mode"]')!;
    if (workMode.value === "") {
        workMode.value = "execute";
    }
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

beforeEach(() => {
    document.body.replaceChildren();
});

describe("移入任务清单弹窗", () => {
    it("标题只预填便条第一段，便条原文单独展示", () => {
        const { dialog, form } = setup();
        const title = form.querySelector<HTMLInputElement>('[data-field="title"]')!;
        expect(title.value).toBe(NOTE_TITLE);
        expect(dialog.element.querySelector('[data-field="note-text"]')?.textContent).toBe(NOTE.text);
    });

    it("弹窗里的文档名默认跟随任务标题", async () => {
        const { form } = setup();
        await vi.waitFor(() => expect(
            form.querySelectorAll(".ticktick-document-picker__row").length,
        ).toBeGreaterThan(0));
        form.querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();

        const title = form.querySelector<HTMLInputElement>('[data-field="title"]')!;
        title.value = "改过的任务标题";
        title.dispatchEvent(new Event("input", { bubbles: true }));

        expect(form.querySelector(".ticktick-document-picker__planned-path")?.textContent)
            .toBe(`将创建：/改过的任务标题`);
    });

    it("没选目标位置就不提交，并给出明确提示", async () => {
        const { form, onCreate } = setup();
        submit(form);
        await vi.waitFor(() => expect(
            form.querySelector('[data-field="target-error"]')?.textContent,
        ).toBe("请选择目标位置。"));
        expect(onCreate).not.toHaveBeenCalled();
    });

    it("选好目标后提交，把目标与便条 id 一起交给调用方", async () => {
        const { form, onCreate } = setup();
        await selectTarget(form);
        submit(form);

        await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
        expect(onCreate.mock.calls[0]?.[0]).toMatchObject({
            target: { kind: "new", name: NOTE_TITLE, path: `/Proposals/${NOTE_TITLE}` },
            task: { title: NOTE_TITLE, url: "", status: "in-progress", workMode: "execute" },
        });
    });

    it("便条删除失败时显示专门的文案，不谎报任务创建失败", async () => {
        const { dialog, form } = setup(async () => ({
            ok: false,
            reason: "note-remove-failed",
            blockId: "b",
        }));
        await selectTarget(form);
        submit(form);

        await vi.waitFor(() => expect(
            form.querySelector('[data-field="error"]')?.textContent,
        ).toBe("任务已创建，但收件箱便条未能删除，请手动处理。"));
        expect(dialog.element.querySelector(".ticktick-task-form__error")).not.toBeNull();
    });

    it("新建文档失败时提示便条未改动", async () => {
        const { form } = setup(async () => ({
            ok: false,
            reason: "document-create-failed",
        }));
        await selectTarget(form);
        submit(form);

        await vi.waitFor(() => expect(
            form.querySelector('[data-field="error"]')?.textContent,
        ).toBe("新建文档失败，便条未改动。"));
    });

    it("标题清空后提交会被校验拦住", async () => {
        const { form, onCreate } = setup();
        await selectTarget(form);
        form.querySelector<HTMLInputElement>('[data-field="title"]')!.value = "   ";
        submit(form);

        await vi.waitFor(() => expect(
            form.querySelector('[data-field="error"]')?.textContent,
        ).toBe("请输入任务名称。"));
        expect(onCreate).not.toHaveBeenCalled();
    });
});
