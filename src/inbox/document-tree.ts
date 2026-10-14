import type { ChildDocument } from "../siyuan/documents";

/**
 * 「目标位置」文档树的数据模型。
 *
 * 这棵树直接映射思源的文档层级：笔记本是根，文档是节点，子文档可以无限深。
 * 新建文档时用节点的**笔记本内可读路径**拼出目标路径——这条路正是思源自己的
 * `/api/filetree/createDocWithMd` 接受的形态。
 */

export type DocumentNodeKind = "notebook" | "document";

export type DocumentNode = {
    id: string;
    kind: DocumentNodeKind;
    name: string;
    notebookId: string;
    /** 传给 listDocsByPath 的 path；笔记本为 "/"。 */
    filePath: string;
    /** 笔记本内的可读路径，例如 /Proposals/Chandra；笔记本为 ""。 */
    humanPath: string;
    /** 是否可能还有下一级（笔记本一律按有处理）。 */
    hasChildren: boolean;
};

export function createNotebookNode(notebook: { id: string; name: string }): DocumentNode {
    return {
        id: notebook.id,
        kind: "notebook",
        name: notebook.name,
        notebookId: notebook.id,
        filePath: "/",
        humanPath: "",
        hasChildren: true,
    };
}

export function createDocumentNode(parent: DocumentNode, child: ChildDocument): DocumentNode {
    return {
        id: child.id,
        kind: "document",
        name: child.title,
        notebookId: parent.notebookId,
        filePath: child.path,
        humanPath: joinHumanPath(parent.humanPath, child.title),
        hasChildren: child.subFileCount > 0,
    };
}

export function joinHumanPath(parent: string, name: string): string {
    const normalizedParent = parent.endsWith("/") ? parent.slice(0, -1) : parent;
    return `${normalizedParent}/${name}`;
}

/**
 * 新文档的目标路径：在笔记本里就是 /名称，在文档下就是 /父/…/名称。
 * 名称里的 "/" 会让路径产生额外的层级，所以直接拒绝而不是悄悄替换。
 */
export type NewDocumentNameResult =
    | { valid: true; name: string }
    | { valid: false; reason: "name-empty" | "name-invalid" };

export function normalizeNewDocumentName(value: unknown): NewDocumentNameResult {
    const name = typeof value === "string" ? value.trim() : "";
    if (name.length === 0) {
        return { valid: false, reason: "name-empty" };
    }
    if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
        return { valid: false, reason: "name-invalid" };
    }
    return { valid: true, name };
}

export const MAX_DEFAULT_DOCUMENT_NAME_LENGTH = 120;

/**
 * 从便条文字推出默认文档名：压平换行、去掉路径分隔符、折叠空白、限长。
 * 只用于**默认值**——用户自己敲进"文档名"框的内容仍然走严格校验，
 * 不会把斜杠偷偷替换掉。
 */
export function toDefaultDocumentName(value: string): string {
    return value
        .replace(/\r\n|\r|\n/g, " ")
        .replace(/[/\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_DEFAULT_DOCUMENT_NAME_LENGTH);
}

export function newDocumentPath(parent: DocumentNode, name: string): string {
    return joinHumanPath(parent.humanPath, name);
}

/** 关键字是否命中该节点（用于在树里快速定位，命中不改变层级关系）。 */
export function matchesDocumentKeyword(node: DocumentNode, keyword: string): boolean {
    const query = keyword.trim().toLocaleLowerCase();
    if (query === "") {
        return true;
    }
    return node.name.toLocaleLowerCase().includes(query)
        || node.humanPath.toLocaleLowerCase().includes(query);
}
