/**
 * 便条正文用的最小 Markdown 渲染器。
 *
 * 刻意**不用 innerHTML、不引第三方库**：
 * - 思源前端没有把 Markdown 渲染入口（`Md2HTML`）打进包里，拿不到它的渲染器；
 * - 便条正文可能来自粘贴的邮件内容，走 innerHTML 会带进脚本与内联样式。
 *
 * 直接构造 DOM 节点，既没有注入面，也能用固定输入单测。
 * 覆盖范围就是"基础 Markdown"：段落、粗体、斜体、行内代码、链接、无序列表、引用。
 */

export type MarkdownBlock =
    | { kind: "paragraph"; text: string }
    | { kind: "list"; items: string[] }
    | { kind: "quote"; text: string };

/** 把原始文本切成块级结构；无法识别的行按普通段落处理。 */
export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
    const lines = source.replace(/\r\n|\r/g, "\n").split("\n");
    const blocks: MarkdownBlock[] = [];
    let paragraph: string[] = [];
    let list: string[] = [];
    let quote: string[] = [];

    const flushParagraph = (): void => {
        if (paragraph.length > 0) {
            blocks.push({ kind: "paragraph", text: paragraph.join("\n").trim() });
            paragraph = [];
        }
    };
    const flushList = (): void => {
        if (list.length > 0) {
            blocks.push({ kind: "list", items: [...list] });
            list = [];
        }
    };
    const flushQuote = (): void => {
        if (quote.length > 0) {
            blocks.push({ kind: "quote", text: quote.join("\n").trim() });
            quote = [];
        }
    };
    const flushAll = (): void => {
        flushParagraph();
        flushList();
        flushQuote();
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.trim() === "") {
            flushAll();
            continue;
        }
        const listMatch = /^\s*[-*+]\s+(.*)$/.exec(line);
        if (listMatch) {
            flushParagraph();
            flushQuote();
            list.push(listMatch[1]!.trim());
            continue;
        }
        const quoteMatch = /^\s*>\s?(.*)$/.exec(line);
        if (quoteMatch) {
            flushParagraph();
            flushList();
            quote.push(quoteMatch[1]!);
            continue;
        }
        flushList();
        flushQuote();
        paragraph.push(line);
    }
    flushAll();
    return blocks.filter((block) => (
        block.kind === "list" ? block.items.length > 0 : block.text !== ""
    ));
}

type InlineToken =
    | { kind: "text"; text: string }
    | { kind: "strong"; text: string }
    | { kind: "em"; text: string }
    | { kind: "code"; text: string }
    | { kind: "link"; text: string; href: string };

const INLINE_PATTERN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\(([^()\s]+)\))/;

/** 把一行文本切成行内片段。链接只接受 http/https，其它协议按普通文字处理。 */
export function parseInlineMarkdown(source: string): InlineToken[] {
    const tokens: InlineToken[] = [];
    let rest = source;
    while (rest.length > 0) {
        const match = INLINE_PATTERN.exec(rest);
        if (!match || match.index === undefined) {
            tokens.push({ kind: "text", text: rest });
            break;
        }
        if (match.index > 0) {
            tokens.push({ kind: "text", text: rest.slice(0, match.index) });
        }
        const [whole, code, strong, em, link, href] = match;
        if (code) {
            tokens.push({ kind: "code", text: code.slice(1, -1) });
        } else if (strong) {
            tokens.push({ kind: "strong", text: strong.slice(2, -2) });
        } else if (em) {
            tokens.push({ kind: "em", text: em.slice(1, -1) });
        } else if (link && href && isSafeHref(href)) {
            tokens.push({ kind: "link", text: link.slice(1, link.indexOf("]")), href });
        } else if (link) {
            tokens.push({ kind: "text", text: link });
        }
        rest = rest.slice(match.index + whole.length);
    }
    return tokens.filter((token) => token.kind === "link" || token.text !== "");
}

export function isSafeHref(href: string): boolean {
    return /^https?:\/\/\S+$/i.test(href);
}

/** 渲染成 DOM 片段；所有文字都经 textContent 写入。 */
export function renderMarkdownBlocks(
    source: string,
    ownerDocument: Document = document,
): HTMLElement[] {
    return parseMarkdownBlocks(source).map((block) => {
        if (block.kind === "list") {
            const list = ownerDocument.createElement("ul");
            for (const item of block.items) {
                const li = ownerDocument.createElement("li");
                li.append(...renderInline(item, ownerDocument));
                list.append(li);
            }
            return list;
        }
        if (block.kind === "quote") {
            const quote = ownerDocument.createElement("blockquote");
            quote.append(...renderInline(block.text, ownerDocument));
            return quote;
        }
        const paragraph = ownerDocument.createElement("p");
        paragraph.append(...renderInline(block.text, ownerDocument));
        return paragraph;
    });
}

export function renderInline(source: string, ownerDocument: Document = document): Node[] {
    return parseInlineMarkdown(source).map((token) => {
        switch (token.kind) {
            case "strong": {
                const element = ownerDocument.createElement("strong");
                element.textContent = token.text;
                return element;
            }
            case "em": {
                const element = ownerDocument.createElement("em");
                element.textContent = token.text;
                return element;
            }
            case "code": {
                const element = ownerDocument.createElement("code");
                element.textContent = token.text;
                return element;
            }
            case "link": {
                const element = ownerDocument.createElement("a");
                element.href = token.href;
                element.target = "_blank";
                element.rel = "noopener noreferrer";
                element.textContent = token.text;
                return element;
            }
            default:
                return ownerDocument.createTextNode(token.text);
        }
    });
}
