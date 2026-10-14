// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
    isSafeHref,
    parseInlineMarkdown,
    parseMarkdownBlocks,
    renderMarkdownBlocks,
} from "./inbox-markdown";

describe("parseMarkdownBlocks", () => {
    it("按空行切段落，单换行在段落内保留", () => {
        expect(parseMarkdownBlocks("第一行\n第二行\n\n第二段")).toEqual([
            { kind: "paragraph", text: "第一行\n第二行" },
            { kind: "paragraph", text: "第二段" },
        ]);
    });

    it("识别无序列表与引用", () => {
        expect(parseMarkdownBlocks("- 甲\n- 乙\n\n> 引用一句")).toEqual([
            { kind: "list", items: ["甲", "乙"] },
            { kind: "quote", text: "引用一句" },
        ]);
    });

    it("空输入与纯空白不产生块", () => {
        expect(parseMarkdownBlocks("")).toEqual([]);
        expect(parseMarkdownBlocks("  \n\n  ")).toEqual([]);
    });

    it("认不出的写法按普通段落处理，不吞内容", () => {
        expect(parseMarkdownBlocks("1. 有序也行")).toEqual([
            { kind: "paragraph", text: "1. 有序也行" },
        ]);
    });
});

describe("parseInlineMarkdown", () => {
    it("识别粗体、斜体、行内代码与链接", () => {
        expect(parseInlineMarkdown("看 **这里** 和 *那里* 与 `code` 见 [文档](https://example.com/a)"))
            .toEqual([
                { kind: "text", text: "看 " },
                { kind: "strong", text: "这里" },
                { kind: "text", text: " 和 " },
                { kind: "em", text: "那里" },
                { kind: "text", text: " 与 " },
                { kind: "code", text: "code" },
                { kind: "text", text: " 见 " },
                { kind: "link", text: "文档", href: "https://example.com/a" },
            ]);
    });

    it("只接受 http/https 链接，其它协议当普通文字", () => {
        expect(isSafeHref("https://example.com")).toBe(true);
        expect(isSafeHref("http://example.com")).toBe(true);
        expect(isSafeHref("javascript:alert(1)")).toBe(false);
        expect(isSafeHref("siyuan://blocks/20260101000000-aaaaaaa")).toBe(false);
        expect(parseInlineMarkdown("[点我](javascript:alert(1))")).toEqual([
            { kind: "text", text: "[点我](javascript:alert(1))" },
        ]);
    });

    it("没有标记时原样返回一段文字", () => {
        expect(parseInlineMarkdown("就是普通一句话")).toEqual([
            { kind: "text", text: "就是普通一句话" },
        ]);
    });
});

describe("renderMarkdownBlocks", () => {
    it("生成真实 DOM，且文字走 textContent（不解析 HTML）", () => {
        const nodes = renderMarkdownBlocks("**粗** 与 <img src=x onerror=alert(1)>");
        const paragraph = nodes[0]!;
        expect(paragraph.tagName).toBe("P");
        expect(paragraph.querySelector("strong")?.textContent).toBe("粗");
        // 标签被当成纯文本，不会变成元素
        expect(paragraph.querySelector("img")).toBeNull();
        expect(paragraph.textContent).toContain("<img src=x onerror=alert(1)>");
    });

    it("列表与引用渲染成对应元素", () => {
        const nodes = renderMarkdownBlocks("- 甲\n- 乙\n\n> 引用");
        expect(nodes[0]?.tagName).toBe("UL");
        expect(nodes[0]?.querySelectorAll("li")).toHaveLength(2);
        expect(nodes[1]?.tagName).toBe("BLOCKQUOTE");
    });

    it("链接带上安全属性", () => {
        const nodes = renderMarkdownBlocks("[文档](https://example.com)");
        const link = nodes[0]?.querySelector("a")!;
        expect(link.getAttribute("href")).toBe("https://example.com");
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    });
});
