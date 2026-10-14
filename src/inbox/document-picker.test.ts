// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Translate } from "../i18n";
import { DocumentPicker } from "./document-picker";

const translate = ((key: string) => ({
    "inboxPromote.targetPlaceholder": "搜索文档标题…",
    "inboxPromote.targetLabel": "任务放到哪（每次都要选）",
    "inboxPromote.treeLabel": "任务放到哪",
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
}[key] ?? key)) as Translate;

const NOTEBOOKS = [
    { id: "20260101000000-aaaaaaa", name: "Microquasar Candidate" },
    { id: "20260101000009-zzzzzzz", name: "COSI" },
];

const CHILDREN: Record<string, { id: string; path: string; title: string; subFileCount: number }[]> = {
    "/": [
        { id: "20260101000001-bbbbbbb", path: "/20260101000001-bbbbbbb.sy", title: "Proposals", subFileCount: 1 },
    ],
    "/20260101000001-bbbbbbb.sy": [
        { id: "20260101000002-ccccccc", path: "/20260101000001-bbbbbbb/20260101000002-ccccccc.sy", title: "Chandra", subFileCount: 0 },
    ],
};

function setup(options: {
    defaultName?: string;
    searchHits?: Array<{ id: string; notebookId: string; name: string; humanPath: string }>;
    failNotebooks?: boolean;
} = {}) {
    const onChange = vi.fn();
    const target = document.createElement("div");
    document.body.append(target);
    const picker = new DocumentPicker({
        translate,
        api: {
            listNotebooks: vi.fn(async () => {
                if (options.failNotebooks) {
                    throw new Error("boom");
                }
                return NOTEBOOKS;
            }),
            listChildDocuments: vi.fn(async (_notebookId, path) => CHILDREN[path] ?? []),
            searchDocuments: vi.fn(async () => options.searchHits ?? []),
        },
        ...(options.defaultName === undefined ? {} : { defaultName: options.defaultName }),
        onChange,
    });
    target.append(picker.element);
    return { picker, target, onChange };
}

function rows(target: HTMLElement): HTMLElement[] {
    return Array.from(target.querySelectorAll<HTMLElement>(".ticktick-document-picker__row"));
}

function rowNames(target: HTMLElement): string[] {
    return Array.from(target.querySelectorAll(".ticktick-document-picker__name"))
        .map((element) => element.textContent ?? "");
}

function rowByNodeId(target: HTMLElement, nodeId: string): HTMLElement {
    return rows(target).find((row) => row.dataset.nodeId === nodeId)!;
}

function plannedText(target: HTMLElement): string {
    return target.querySelector(".ticktick-document-picker__planned")?.textContent ?? "";
}

async function expandFirst(target: HTMLElement): Promise<void> {
    await vi.waitFor(() => expect(rows(target).length).toBeGreaterThan(0));
    rows(target)[0]!.querySelector<HTMLButtonElement>(".ticktick-document-picker__twisty")!.click();
    await vi.waitFor(() => expect(rowNames(target)).toContain("Proposals"));
}

beforeEach(() => {
    document.body.replaceChildren();
});

describe("DocumentPicker：选的是「新文档放在哪」", () => {
    it("一开始没有任何选中项——每次移入都必须由用户亲自选", async () => {
        const { picker, target, onChange } = setup();
        await picker.start();

        expect(picker.getTarget()).toBeUndefined();
        expect(target.querySelector(".ticktick-document-picker__row--selected")).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
        expect(plannedText(target)).toContain("还没选位置");
    });

    it("逐级展开可以走到任意深度", async () => {
        const { picker, target } = setup();
        await picker.start();
        await expandFirst(target);

        rowByNodeId(target, "20260101000001-bbbbbbb")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__twisty")!.click();
        await vi.waitFor(() => expect(rowNames(target)).toContain("Chandra"));

        expect(rowNames(target)).toEqual(["Microquasar Candidate", "Proposals", "Chandra", "COSI"]);
    });

    it("点文档 = 新文档建在它下面，而不是把任务塞进它里面", async () => {
        const { picker, target } = setup({ defaultName: "给 GRB 写说明" });
        await picker.start();
        await expandFirst(target);

        rowByNodeId(target, "20260101000001-bbbbbbb")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();

        expect(picker.getTarget()).toMatchObject({
            kind: "new",
            name: "给 GRB 写说明",
            path: "/Proposals/给 GRB 写说明",
        });
        const row = rowByNodeId(target, "20260101000001-bbbbbbb");
        expect(row.classList.contains("ticktick-document-picker__row--selected")).toBe(true);
        expect(row.textContent).toContain("新文档建在它下面");
        expect(plannedText(target)).toContain("将创建：/Proposals/给 GRB 写说明");
    });

    it("点笔记本 = 新文档建在它根下", async () => {
        const { picker, target } = setup({ defaultName: "读 referee 意见" });
        await picker.start();

        rowByNodeId(target, "20260101000009-zzzzzzz")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();

        expect(picker.getTarget()).toMatchObject({
            kind: "new",
            name: "读 referee 意见",
            path: "/读 referee 意见",
        });
    });

    it("改选另一个位置时高亮跟着走，只剩一个选中项", async () => {
        const { picker, target } = setup({ defaultName: "任务" });
        await picker.start();
        await expandFirst(target);

        rowByNodeId(target, "20260101000001-bbbbbbb")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();
        rowByNodeId(target, "20260101000009-zzzzzzz")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();

        const selected = target.querySelectorAll(".ticktick-document-picker__row--selected");
        expect(selected).toHaveLength(1);
        expect(selected[0]?.getAttribute("data-node-id")).toBe("20260101000009-zzzzzzz");
        expect(picker.getTarget()).toMatchObject({ path: "/任务" });
    });
});

describe("DocumentPicker：默认文档名", () => {
    it("默认名清理掉换行与路径分隔符，避免一上来就非法", async () => {
        const { picker, target } = setup({ defaultName: "Abstracts for Oct 20\n\nsee http://a/b" });
        await picker.start();
        rowByNodeId(target, "20260101000009-zzzzzzz")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();

        const target_ = picker.getTarget();
        expect(target_?.kind).toBe("new");
        expect(target_ && target_.kind === "new" ? target_.name : "").toBe("Abstracts for Oct 20 see http: a b");
    });

    it("任务标题变化会同步文档名", async () => {
        const { picker, target } = setup({ defaultName: "旧标题" });
        await picker.start();
        rowByNodeId(target, "20260101000009-zzzzzzz")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();

        picker.setDefaultName("新标题");

        expect(picker.getTarget()).toMatchObject({ name: "新标题", path: "/新标题" });
        expect(plannedText(target)).toContain("将创建：/新标题");
    });

    it("用户手动改过文档名之后，标题不再覆盖它", async () => {
        const { picker, target } = setup({ defaultName: "原始标题" });
        await picker.start();
        rowByNodeId(target, "20260101000009-zzzzzzz")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();

        const input = target.querySelector<HTMLInputElement>(".ticktick-document-picker__name-input")!;
        input.value = "我自己起的名字";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        picker.setDefaultName("任务标题改了");

        expect(picker.getTarget()).toMatchObject({ name: "我自己起的名字" });
    });

    it("文档名为空或含斜杠时不产生目标，并给出原因", async () => {
        const { picker, target } = setup({ defaultName: "任务" });
        await picker.start();
        rowByNodeId(target, "20260101000009-zzzzzzz")
            .querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();

        const input = target.querySelector<HTMLInputElement>(".ticktick-document-picker__name-input")!;
        const path = target.querySelector<HTMLElement>(".ticktick-document-picker__planned-path")!;

        input.value = "   ";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        expect(picker.getTarget()).toBeUndefined();
        expect(path.textContent).toBe("请输入文档名称。");

        input.value = "a/b";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        expect(picker.getTarget()).toBeUndefined();
        expect(path.textContent).toBe("文档名称不能包含斜杠。");
    });
});

describe("DocumentPicker：搜索与展开的稳定性", () => {
    it("搜索命中可以跨层级直接作为父位置", async () => {
        const { picker, target } = setup({
            defaultName: "任务",
            searchHits: [{
                id: "20260101000003-ddddddd",
                notebookId: NOTEBOOKS[0]!.id,
                name: "Cycle 28 Proposal Review Task",
                humanPath: "/Proposals/Chandra/Cycle 28",
            }],
        });
        await picker.start();

        const input = target.querySelector<HTMLInputElement>(".ticktick-document-picker__search")!;
        input.value = "Cycle 28";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.waitFor(
            () => expect(rowNames(target)).toContain("Cycle 28 Proposal Review Task"),
            { timeout: 2000 },
        );

        rows(target)[0]!.querySelector<HTMLButtonElement>(".ticktick-document-picker__label")!.click();
        expect(picker.getTarget()).toMatchObject({
            path: "/Proposals/Chandra/Cycle 28/任务",
        });
    });

    it("搜不到时给出明确提示，不自动新建任何东西", async () => {
        const { picker, target } = setup();
        await picker.start();

        const input = target.querySelector<HTMLInputElement>(".ticktick-document-picker__search")!;
        input.value = "不存在的文档";
        input.dispatchEvent(new Event("input", { bubbles: true }));

        await vi.waitFor(() => expect(
            target.querySelector(".ticktick-document-picker__message")?.textContent,
        ).toBe("没有匹配的文档。"), { timeout: 2000 });
        expect(picker.getTarget()).toBeUndefined();
    });

    it("展开靠下的位置后不会跳回顶部", async () => {
        // jsdom 没有布局，scrollTop 不会自己变化；这里换成可控实现，
        // 模拟真实的可滚动容器，才能复现「点一下就被弹回最上面」这个缺陷。
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop");
        const positions = new WeakMap<HTMLElement, number>();
        Object.defineProperty(HTMLElement.prototype, "scrollTop", {
            configurable: true,
            get(this: HTMLElement) {
                return positions.get(this) ?? 0;
            },
            set(this: HTMLElement, value: number) {
                positions.set(this, value);
            },
        });
        try {
            const { picker, target } = setup();
            await picker.start();

            target.querySelector<HTMLElement>(".ticktick-document-picker__tree")!.scrollTop = 240;
            rows(target)[0]!.querySelector<HTMLButtonElement>(".ticktick-document-picker__twisty")!.click();
            await vi.waitFor(() => expect(rowNames(target)).toContain("Proposals"));

            expect(target.querySelector<HTMLElement>(".ticktick-document-picker__tree")!.scrollTop)
                .toBe(240);
        } finally {
            if (original) {
                Object.defineProperty(HTMLElement.prototype, "scrollTop", original);
            } else {
                delete (HTMLElement.prototype as { scrollTop?: unknown }).scrollTop;
            }
        }
    });

    it("展开后焦点回到刚点的那个节点", async () => {
        const { picker, target } = setup();
        await picker.start();

        rows(target)[0]!.querySelector<HTMLButtonElement>(".ticktick-document-picker__twisty")!.click();
        await vi.waitFor(() => expect(rowNames(target)).toContain("Proposals"));

        const focused = document.activeElement as HTMLElement | null;
        expect(focused?.classList.contains("ticktick-document-picker__twisty")).toBe(true);
        expect(focused?.closest<HTMLElement>(".ticktick-document-picker__row")?.dataset.nodeId)
            .toBe(NOTEBOOKS[0]!.id);
    });

    it("笔记本列表读取失败时给出空树而不是崩溃", async () => {
        const { picker, target } = setup({ failNotebooks: true });
        await picker.start();

        expect(rowNames(target)).toEqual([]);
        expect(picker.getTarget()).toBeUndefined();
    });
});
