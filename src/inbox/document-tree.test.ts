import { describe, expect, it } from "vitest";

import {
    createDocumentNode,
    createNotebookNode,
    joinHumanPath,
    matchesDocumentKeyword,
    newDocumentPath,
    normalizeNewDocumentName,
} from "./document-tree";

const NOTEBOOK = { id: "20260901113044-xlqugvl", name: "Microquasar Candidate" };

function child(id: string, title: string, subFileCount = 0, path = `/${id}.sy`) {
    return { id, path, title, subFileCount };
}

describe("文档树节点", () => {
    it("笔记本节点的可读路径是空串，filePath 是根", () => {
        const node = createNotebookNode(NOTEBOOK);
        expect(node).toMatchObject({
            id: NOTEBOOK.id,
            kind: "notebook",
            name: NOTEBOOK.name,
            notebookId: NOTEBOOK.id,
            filePath: "/",
            humanPath: "",
            hasChildren: true,
        });
    });

    it("文档节点在父节点基础上续写可读路径", () => {
        const root = createNotebookNode(NOTEBOOK);
        const proposals = createDocumentNode(root, child("20260101000000-aaaaaaa", "Proposals", 1));
        const chandra = createDocumentNode(proposals, child("20260101000001-bbbbbbb", "Chandra"));

        expect(proposals.humanPath).toBe("/Proposals");
        expect(chandra.humanPath).toBe("/Proposals/Chandra");
        expect(chandra.notebookId).toBe(NOTEBOOK.id);
        expect(chandra.filePath).toBe("/20260101000001-bbbbbbb.sy");
    });

    it("按子文档数量判断是否还能展开", () => {
        const root = createNotebookNode(NOTEBOOK);
        expect(createDocumentNode(root, child("20260101000000-aaaaaaa", "A", 0)).hasChildren).toBe(false);
        expect(createDocumentNode(root, child("20260101000000-aaaaaaa", "A", 2)).hasChildren).toBe(true);
    });

    it("拼接路径时不会出现双斜杠", () => {
        expect(joinHumanPath("", "A")).toBe("/A");
        expect(joinHumanPath("/A", "B")).toBe("/A/B");
        expect(joinHumanPath("/A/", "B")).toBe("/A/B");
    });
});

describe("新文档名称与路径", () => {
    it("去掉首尾空白后接受普通名称", () => {
        expect(normalizeNewDocumentName("  GRB 样本筛选  ")).toEqual({
            valid: true,
            name: "GRB 样本筛选",
        });
    });

    it("拒绝空名称、斜杠和相对路径片段", () => {
        for (const value of ["", "   ", "a/b", "a\\b", ".", "..", undefined, 42]) {
            const result = normalizeNewDocumentName(value);
            expect(result.valid).toBe(false);
        }
        expect(normalizeNewDocumentName("a/b")).toEqual({ valid: false, reason: "name-invalid" });
        expect(normalizeNewDocumentName("  ")).toEqual({ valid: false, reason: "name-empty" });
    });

    it("新文档路径落在选中的父位置下面，能建到任意深度", () => {
        const root = createNotebookNode(NOTEBOOK);
        const proposals = createDocumentNode(root, child("20260101000000-aaaaaaa", "Proposals", 1));
        const chandra = createDocumentNode(proposals, child("20260101000001-bbbbbbb", "Chandra"));

        expect(newDocumentPath(root, "顶层文档")).toBe("/顶层文档");
        expect(newDocumentPath(chandra, "GRB 样本筛选")).toBe("/Proposals/Chandra/GRB 样本筛选");
    });
});

describe("关键字匹配", () => {
    const node = createDocumentNode(
        createNotebookNode(NOTEBOOK),
        child("20260101000001-bbbbbbb", "Cycle 28 Proposal Review"),
    );

    it("空关键字一律命中", () => {
        expect(matchesDocumentKeyword(node, "   ")).toBe(true);
    });

    it("按名称或可读路径匹配，且忽略大小写", () => {
        expect(matchesDocumentKeyword(node, "cycle")).toBe(true);
        expect(matchesDocumentKeyword(node, "PROPOSAL")).toBe(true);
        expect(matchesDocumentKeyword(node, "不存在的词")).toBe(false);
    });
});
