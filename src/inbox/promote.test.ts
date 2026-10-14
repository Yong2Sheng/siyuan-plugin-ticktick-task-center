import { describe, expect, it, vi } from "vitest";

import type { NormalizedTaskData } from "../domain/validation";
import type { DocumentTarget } from "./document-picker";
import {
    PromoteTaskError,
    promoteToTaskList,
    promoteToTaskListOrThrow,
    resolveTargetDocument,
    type PromoteTaskApi,
} from "./promote";

const TASK: NormalizedTaskData = {
    title: "给 GRB 那篇的样本筛选写一段可复现的说明",
    url: "",
    status: "in-progress",
    workMode: "execute",
};

const EXISTING_TARGET: DocumentTarget = {
    kind: "existing",
    documentId: "20260101000000-aaaaaaa",
    label: "/GRB",
    node: {
        id: "20260101000000-aaaaaaa",
        kind: "document",
        name: "GRB",
        notebookId: "20260101000001-bbbbbbb",
        filePath: "/20260101000000-aaaaaaa.sy",
        humanPath: "/GRB",
        hasChildren: false,
    },
};

const NEW_TARGET: DocumentTarget = {
    kind: "new",
    parent: EXISTING_TARGET.node,
    name: "GRB 样本筛选",
    path: "/GRB/GRB 样本筛选",
};

function createApi(overrides: Partial<PromoteTaskApi> = {}) {
    const calls: string[] = [];
    const api: PromoteTaskApi = {
        createTaskBlock: vi.fn(async () => {
            calls.push("create");
            return { blockId: "20260101000002-ccccccc" };
        }),
        insertNoteBody: vi.fn(async () => {
            calls.push("body");
        }),
        removeInboxNote: vi.fn(async () => {
            calls.push("remove");
            return true;
        }),
        ...overrides,
    };
    return { api, calls };
}

describe("promoteToTaskList", () => {
    it("先建任务块，再删便条", async () => {
        const { api, calls } = createApi();
        const result = await promoteToTaskList(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
            noteId: "note-1",
        });

        expect(result).toEqual({ ok: true, blockId: "20260101000002-ccccccc", noteRemoved: true });
        // 顺序不能反：反过来一旦建块失败，便条已经没了
        expect(calls).toEqual(["create", "remove"]);
    });

    it("有正文时按「建块 → 写正文 → 删便条」执行", async () => {
        const { api, calls } = createApi();
        const result = await promoteToTaskList(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
            noteId: "note-1",
            noteBody: "PAARE Colleagues,\n\nPlease get these to me soon.",
        });

        expect(result.ok).toBe(true);
        // 正文必须落在删便条之前：便条一删，正文就只剩文档里那一份
        expect(calls).toEqual(["create", "body", "remove"]);
        expect(api.insertNoteBody).toHaveBeenCalledWith(
            "20260101000002-ccccccc",
            "PAARE Colleagues,\n\nPlease get these to me soon.",
        );
    });

    it("没有正文时不写正文", async () => {
        const { api } = createApi();
        await promoteToTaskList(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
            noteId: "note-1",
            noteBody: "   ",
        });

        expect(api.insertNoteBody).not.toHaveBeenCalled();
    });

    it("正文写入失败时保留便条，什么都不丢", async () => {
        const { api } = createApi({
            insertNoteBody: vi.fn(async () => {
                throw new Error("insert failed");
            }),
        });
        const result = await promoteToTaskList(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
            noteId: "note-1",
            noteBody: "正文",
        });

        expect(result).toEqual({
            ok: false,
            reason: "note-body-failed",
            blockId: "20260101000002-ccccccc",
        });
        expect(api.removeInboxNote).not.toHaveBeenCalled();
    });

    it("入口 2 没选便条时不删除任何东西", async () => {
        const { api } = createApi();
        const result = await promoteToTaskList(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
        });

        expect(result).toEqual({ ok: true, blockId: "20260101000002-ccccccc", noteRemoved: false });
        expect(api.removeInboxNote).not.toHaveBeenCalled();
    });

    it("建块失败时不碰便条", async () => {
        const { api } = createApi({
            createTaskBlock: vi.fn(async () => {
                throw new Error("insert failed");
            }),
        });
        const result = await promoteToTaskList(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
            noteId: "note-1",
        });

        expect(result).toEqual({ ok: false, reason: "task-create-failed" });
        expect(api.removeInboxNote).not.toHaveBeenCalled();
    });

    it("便条删除失败时如实报告，并保留刚建好的任务块", async () => {
        const { api } = createApi({ removeInboxNote: vi.fn(async () => false) });
        const result = await promoteToTaskList(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
            noteId: "note-1",
        });

        // 不假装成功，也不回滚任务块——回滚会把用户刚建的任务一起弄没
        expect(result).toEqual({
            ok: false,
            reason: "note-remove-failed",
            blockId: "20260101000002-ccccccc",
        });
    });

    it("便条删除抛错时同样如实报告，不把异常当成成功", async () => {
        const { api } = createApi({
            removeInboxNote: vi.fn(async () => {
                throw new Error("save failed");
            }),
        });
        await expect(promoteToTaskList(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
            noteId: "note-1",
        })).rejects.toThrow("save failed");
    });

    it("抛出式包装保留失败原因", async () => {
        const { api } = createApi({ removeInboxNote: vi.fn(async () => false) });
        await expect(promoteToTaskListOrThrow(api, {
            rootDocumentId: EXISTING_TARGET.documentId,
            taskLabel: "思源任务",
            task: TASK,
            noteId: "note-1",
        })).rejects.toBeInstanceOf(PromoteTaskError);
    });
});

describe("resolveTargetDocument", () => {
    it("选已有文档时直接返回它的 ID，不新建", async () => {
        const createDocument = vi.fn(async () => "unused");
        const result = await resolveTargetDocument({ createDocument }, EXISTING_TARGET);

        expect(result).toEqual({ ok: true, documentId: EXISTING_TARGET.documentId });
        expect(createDocument).not.toHaveBeenCalled();
    });

    it("选新建时用父位置所在笔记本与路径建文档", async () => {
        const createDocument = vi.fn(async () => "20260101000003-ddddddd");
        const result = await resolveTargetDocument({ createDocument }, NEW_TARGET);

        expect(result).toEqual({ ok: true, documentId: "20260101000003-ddddddd" });
        expect(createDocument).toHaveBeenCalledWith(
            EXISTING_TARGET.node.notebookId,
            "/GRB/GRB 样本筛选",
            "",
        );
    });

    it("新建文档失败时返回明确原因", async () => {
        const createDocument = vi.fn(async () => {
            throw new Error("create failed");
        });
        await expect(resolveTargetDocument({ createDocument }, NEW_TARGET)).resolves.toEqual({
            ok: false,
            reason: "document-create-failed",
        });
    });
});
