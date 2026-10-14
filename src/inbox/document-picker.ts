import type { Translate } from "../i18n";
import type { ChildDocument, DocumentSearchHit } from "../siyuan/documents";
import {
    createDocumentNode,
    createNotebookNode,
    newDocumentPath,
    normalizeNewDocumentName,
    toDefaultDocumentName,
    type DocumentNode,
} from "./document-tree";

export type DocumentTarget =
    | { kind: "existing"; documentId: string; label: string; node: DocumentNode }
    | { kind: "new"; parent: DocumentNode; name: string; path: string };

export type DocumentPickerApi = {
    listNotebooks(): Promise<{ id: string; name: string }[]>;
    listChildDocuments(notebookId: string, path: string): Promise<ChildDocument[]>;
    searchDocuments(keyword: string): Promise<DocumentSearchHit[]>;
};

export type DocumentPickerOptions = {
    translate: Translate;
    api: DocumentPickerApi;
    /** 新文档名的初始值与跟随来源，通常是任务标题。 */
    defaultName?: string;
    onChange(target: DocumentTarget | undefined): void;
};

type FocusKind = "twisty" | "label";

type FocusTarget = {
    nodeId: string;
    kind: FocusKind;
};

const FOCUS_KINDS: readonly FocusKind[] = ["twisty", "label"];

const FOCUS_CLASS_NAMES: Record<FocusKind, string> = {
    twisty: "ticktick-document-picker__twisty",
    label: "ticktick-document-picker__label",
};

/**
 * 「任务放到哪」选择器。
 *
 * 语义是**选择新任务文档的父位置**，不是"把任务块塞进哪篇已有文档"——
 * 因为任务文档本身就是任务的载体（一件事 = 一篇文档）。
 * 所以点任意一行（笔记本或文档）＝ 新文档建在它根下/它下面，展开只用左侧三角。
 *
 * 刻意**没有任何默认选中项**：每次移入都必须由用户亲自选。
 */
export class DocumentPicker {
    readonly element = document.createElement("div");

    private readonly searchInput = document.createElement("input");
    private readonly body = document.createElement("div");
    private readonly planned = document.createElement("div");
    private readonly plannedPath = document.createElement("span");
    private readonly plannedHint = document.createElement("span");
    private readonly nameInput = document.createElement("input");
    private readonly childrenByNodeId = new Map<string, DocumentNode[]>();
    private readonly expandedNodeIds = new Set<string>();
    private readonly loadingNodeIds = new Set<string>();
    private searchHits: DocumentNode[] | undefined;
    private viewKey: "tree" | "search" = "tree";
    private pendingFocusNodeId: string | undefined;
    private searchTimer?: number;
    private searchToken = 0;
    private parent: DocumentNode | undefined;
    private target: DocumentTarget | undefined;
    private documentName = "";
    /** 用户手动改过文档名之后，就不再被任务标题覆盖。 */
    private nameEdited = false;
    private destroyed = false;

    constructor(private readonly options: DocumentPickerOptions) {
        this.element.className = "ticktick-document-picker";
        this.element.setAttribute("role", "group");

        this.searchInput.type = "search";
        this.searchInput.className = "b3-text-field ticktick-document-picker__search";
        this.searchInput.addEventListener("input", () => this.scheduleSearch());
        this.body.className = "ticktick-document-picker__body";

        this.planned.className = "ticktick-document-picker__planned";
        this.plannedPath.className = "ticktick-document-picker__planned-path";
        this.plannedHint.className = "ticktick-document-picker__planned-hint";
        this.nameInput.type = "text";
        this.nameInput.className = "b3-text-field ticktick-document-picker__name-input";
        this.nameInput.addEventListener("input", () => {
            this.nameEdited = true;
            this.documentName = this.nameInput.value;
            this.updatePlanned();
            this.emitChange();
        });

        this.documentName = toDefaultDocumentName(options.defaultName ?? "");
        this.applyLabels();
        this.element.append(this.searchInput, this.body, this.planned);
        this.renderPlanned();
        this.render();
    }

    async start(): Promise<void> {
        await this.loadRoots();
    }

    destroy(): void {
        this.destroyed = true;
        if (this.searchTimer !== undefined) {
            window.clearTimeout(this.searchTimer);
        }
        this.element.remove();
    }

    refreshLanguage(): void {
        if (!this.destroyed) {
            this.applyLabels();
            this.render();
        }
    }

    getTarget(): DocumentTarget | undefined {
        return this.target;
    }

    /**
     * 任务标题变化时同步文档名——除非用户已经手动改过文档名，
     * 否则改一个错别字会把用户起的名字冲掉。
     */
    setDefaultName(name: string): void {
        if (this.nameEdited) {
            return;
        }
        this.documentName = toDefaultDocumentName(name);
        this.updatePlanned();
        this.emitChange();
    }

    private applyLabels(): void {
        const { translate } = this.options;
        this.searchInput.placeholder = translate("inboxPromote.targetPlaceholder");
        this.searchInput.setAttribute("aria-label", translate("inboxPromote.targetLabel"));
        this.nameInput.placeholder = translate("inboxPromote.documentName");
        this.nameInput.setAttribute("aria-label", translate("inboxPromote.documentName"));
    }

    private async loadRoots(): Promise<void> {
        try {
            const notebooks = await this.options.api.listNotebooks();
            if (this.destroyed) {
                return;
            }
            this.childrenByNodeId.set("", notebooks.map((notebook) => createNotebookNode(notebook)));
        } catch {
            if (this.destroyed) {
                return;
            }
            this.childrenByNodeId.set("", []);
        }
        this.render();
    }

    private scheduleSearch(): void {
        const keyword = this.searchInput.value;
        if (this.searchTimer !== undefined) {
            window.clearTimeout(this.searchTimer);
        }
        if (keyword.trim() === "") {
            this.searchHits = undefined;
            this.render();
            return;
        }
        this.searchTimer = window.setTimeout(() => {
            this.searchTimer = undefined;
            void this.runSearch(keyword);
        }, 220);
    }

    private async runSearch(keyword: string): Promise<void> {
        const token = ++this.searchToken;
        try {
            const hits = await this.options.api.searchDocuments(keyword);
            if (this.destroyed || token !== this.searchToken) {
                return;
            }
            this.searchHits = hits.map((hit) => ({
                id: hit.id,
                kind: "document" as const,
                name: hit.name,
                notebookId: hit.notebookId,
                filePath: "",
                humanPath: hit.humanPath,
                hasChildren: false,
            }));
        } catch {
            if (this.destroyed || token !== this.searchToken) {
                return;
            }
            this.searchHits = [];
        }
        this.render();
    }

    private async toggleExpand(node: DocumentNode): Promise<void> {
        this.pendingFocusNodeId = node.id;
        if (this.expandedNodeIds.has(node.id)) {
            this.expandedNodeIds.delete(node.id);
            this.render();
            return;
        }
        this.expandedNodeIds.add(node.id);
        if (!this.childrenByNodeId.has(node.id)) {
            this.loadingNodeIds.add(node.id);
            this.render();
            try {
                const children = await this.options.api.listChildDocuments(
                    node.notebookId,
                    node.filePath,
                );
                if (this.destroyed) {
                    return;
                }
                this.childrenByNodeId.set(
                    node.id,
                    children.map((child) => createDocumentNode(node, child)),
                );
            } catch {
                if (!this.destroyed) {
                    this.childrenByNodeId.set(node.id, []);
                }
            } finally {
                this.loadingNodeIds.delete(node.id);
            }
        }
        this.render();
    }

    /** 点任意一行 = 「新文档放在这里」。笔记本＝根下，文档＝它下面。 */
    private selectParent(node: DocumentNode): void {
        this.parent = node;
        this.render();
        this.emitChange();
    }

    private computeTarget(): DocumentTarget | undefined {
        if (!this.parent) {
            return undefined;
        }
        const name = normalizeNewDocumentName(this.documentName);
        if (!name.valid) {
            return undefined;
        }
        return {
            kind: "new",
            parent: this.parent,
            name: name.name,
            path: newDocumentPath(this.parent, name.name),
        };
    }

    private emitChange(): void {
        const next = this.computeTarget();
        const previousPath = this.target?.kind === "new" ? this.target.path : undefined;
        const nextPath = next?.kind === "new" ? next.path : undefined;
        this.target = next;
        if (previousPath !== nextPath) {
            this.options.onChange(next);
        }
    }

    private render(): void {
        if (this.destroyed) {
            return;
        }
        // 展开节点会重建整棵树，如果不显式保留，滚动位置会被重置到顶部——
        // 用户在长列表里点一个靠下的位置，就会被弹回最上面。
        const nextView = this.searchHits !== undefined ? "search" : "tree";
        const keepScroll = nextView === this.viewKey;
        const scrollTop = keepScroll ? this.readTreeScrollTop() : 0;
        if (!keepScroll) {
            this.pendingFocusNodeId = undefined;
        }
        const focusNodeId = this.pendingFocusNodeId;
        // 重建整棵树会连带丢掉焦点：先把当前焦点记下来，重建后再还原。
        const restoreFocus = keepScroll ? this.captureFocus() : undefined;
        this.viewKey = nextView;

        this.body.replaceChildren();
        this.body.append(nextView === "search" ? this.renderSearchResults() : this.renderTree());

        if (keepScroll && scrollTop > 0) {
            this.writeTreeScrollTop(scrollTop);
        }
        // 展开会渲染两次（先加载态、后结果），焦点要一直保留到真正落上去为止
        if (focusNodeId && this.focusTwisty(focusNodeId)) {
            this.pendingFocusNodeId = undefined;
        }
        this.restoreFocus(restoreFocus);
        this.renderPlanned();
    }

    private renderPlanned(): void {
        const { translate } = this.options;
        this.planned.replaceChildren();
        if (!this.parent) {
            this.planned.classList.remove("ticktick-document-picker__planned--ready");
            this.plannedHint.textContent = translate("inboxPromote.plannedEmpty");
            this.planned.append(this.plannedHint);
            return;
        }
        this.planned.classList.add("ticktick-document-picker__planned--ready");
        const row = document.createElement("div");
        row.className = "ticktick-document-picker__planned-row";
        const label = document.createElement("span");
        label.className = "ticktick-document-picker__planned-label";
        label.textContent = translate("inboxPromote.documentName");
        row.append(label, this.nameInput);
        this.planned.append(this.plannedPath, row);
        this.updatePlanned();
    }

    /** 只改文字，绝不重建输入框——否则每敲一个字都会丢焦点。 */
    private updatePlanned(): void {
        const { translate } = this.options;
        if (!this.parent) {
            return;
        }
        if (this.nameInput.value !== this.documentName) {
            this.nameInput.value = this.documentName;
        }
        const name = normalizeNewDocumentName(this.documentName);
        this.plannedPath.dataset.state = name.valid ? "ok" : "error";
        if (!name.valid) {
            this.plannedPath.textContent = this.documentName.trim() === ""
                ? translate("inboxPromote.nameEmpty")
                : translate("inboxPromote.nameInvalid");
            return;
        }
        this.plannedPath.textContent = `${translate("inboxPromote.plannedPrefix")}`
            + newDocumentPath(this.parent, name.name);
    }

    private renderTree(): HTMLElement {
        const tree = document.createElement("div");
        tree.className = "ticktick-document-picker__tree";
        tree.setAttribute("role", "tree");
        tree.setAttribute("aria-label", this.options.translate("inboxPromote.treeLabel"));
        tree.append(...this.renderRows(this.childrenByNodeId.get("") ?? [], 0));
        return tree;
    }

    private renderRows(nodes: readonly DocumentNode[], depth: number): HTMLElement[] {
        const rows: HTMLElement[] = [];
        for (const node of nodes) {
            rows.push(this.renderRow(node, depth));
            if (this.expandedNodeIds.has(node.id)) {
                if (this.loadingNodeIds.has(node.id)) {
                    rows.push(this.renderMessage(
                        this.options.translate("inboxPromote.treeLoading"),
                        depth + 1,
                    ));
                } else {
                    rows.push(...this.renderRows(this.childrenByNodeId.get(node.id) ?? [], depth + 1));
                }
            }
        }
        return rows;
    }

    private renderRow(node: DocumentNode, depth: number): HTMLElement {
        const { translate } = this.options;
        const row = document.createElement("div");
        row.className = "ticktick-document-picker__row";
        row.style.setProperty("--depth", String(depth));
        row.setAttribute("role", "treeitem");
        row.dataset.nodeId = node.id;
        const selected = this.parent?.id === node.id;
        if (selected) {
            row.classList.add("ticktick-document-picker__row--selected");
            row.setAttribute("aria-selected", "true");
        }

        const twisty = document.createElement("button");
        twisty.type = "button";
        twisty.className = "ticktick-document-picker__twisty";
        twisty.textContent = this.expandedNodeIds.has(node.id) ? "▼" : "▶";
        twisty.setAttribute(
            "aria-label",
            this.expandedNodeIds.has(node.id)
                ? translate("inboxPromote.collapse")
                : translate("inboxPromote.expand"),
        );
        twisty.addEventListener("click", (event) => {
            event.stopPropagation();
            void this.toggleExpand(node);
        });

        const label = document.createElement("button");
        label.type = "button";
        label.className = "ticktick-document-picker__label";
        const icon = document.createElement("span");
        icon.className = "ticktick-document-picker__icon";
        icon.textContent = node.kind === "notebook" ? "📓" : "📄";
        const name = document.createElement("span");
        name.className = "ticktick-document-picker__name";
        name.textContent = node.name;
        label.append(icon, name);
        label.addEventListener("click", () => this.selectParent(node));

        row.append(twisty, label);
        if (node.kind === "notebook") {
            const tag = document.createElement("span");
            tag.className = "ticktick-document-picker__tag";
            tag.textContent = translate("inboxPromote.treeNotebookTag");
            row.append(tag);
        }
        if (selected) {
            const picked = document.createElement("span");
            picked.className = "ticktick-document-picker__tag ticktick-document-picker__tag--picked";
            picked.textContent = translate("inboxPromote.pickedParent");
            row.append(picked);
        }
        return row;
    }

    private renderSearchResults(): HTMLElement {
        const { translate } = this.options;
        const list = document.createElement("div");
        list.className = "ticktick-document-picker__tree";
        const hits = this.searchHits ?? [];
        if (hits.length === 0) {
            const empty = document.createElement("div");
            empty.className = "ticktick-document-picker__message";
            empty.textContent = translate("inboxPromote.searchEmpty");
            list.append(empty);
            return list;
        }
        list.append(...this.renderRows(hits, 0));
        return list;
    }

    private renderMessage(message: string, depth: number): HTMLElement {
        const element = document.createElement("div");
        element.className = "ticktick-document-picker__message";
        element.style.setProperty("--depth", String(depth));
        element.textContent = message;
        return element;
    }

    private readTreeScrollTop(): number {
        return this.body
            .querySelector<HTMLElement>(".ticktick-document-picker__tree")
            ?.scrollTop ?? 0;
    }

    private writeTreeScrollTop(value: number): void {
        const tree = this.body.querySelector<HTMLElement>(".ticktick-document-picker__tree");
        if (tree) {
            tree.scrollTop = value;
        }
    }

    private captureFocus(): FocusTarget | undefined {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !this.body.contains(active)) {
            return undefined;
        }
        const nodeId = active
            .closest<HTMLElement>(".ticktick-document-picker__row")
            ?.dataset.nodeId;
        if (!nodeId) {
            return undefined;
        }
        for (const kind of FOCUS_KINDS) {
            if (active.classList.contains(FOCUS_CLASS_NAMES[kind])) {
                return { nodeId, kind };
            }
        }
        return undefined;
    }

    private restoreFocus(target: FocusTarget | undefined): void {
        if (!target) {
            return;
        }
        this.findRow(target.nodeId)
            ?.querySelector<HTMLButtonElement>(`.${FOCUS_CLASS_NAMES[target.kind]}`)
            ?.focus();
    }

    private focusTwisty(nodeId: string): boolean {
        const twisty = this.findRow(nodeId)
            ?.querySelector<HTMLButtonElement>(".ticktick-document-picker__twisty");
        if (!twisty) {
            return false;
        }
        twisty.focus();
        return true;
    }

    private findRow(nodeId: string): HTMLElement | undefined {
        return Array.from(
            this.body.querySelectorAll<HTMLElement>(".ticktick-document-picker__row"),
        ).find((candidate) => candidate.dataset.nodeId === nodeId);
    }
}
