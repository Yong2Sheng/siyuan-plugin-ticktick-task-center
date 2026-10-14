import { describe, expect, it } from "vitest";

import {
    MAX_INBOX_NOTE_TEXT_LENGTH,
    getInboxNoteCompletedDate,
    isInboxNoteCompletionExpired,
    normalizeInboxNoteText,
    parseInboxNote,
    splitInboxNoteText,
    type InboxNote,
} from "./inbox-note";

const NOTE: InboxNote = {
    id: "note-abc-0000001",
    text: "帮师兄找一下去年 COSI 的那份观测记录",
    tier: "quick",
    createdAt: "2026-10-11T14:32:00.000Z",
};

describe("normalizeInboxNoteText", () => {
    it("接受去掉首尾空白后的非空文字", () => {
        expect(normalizeInboxNoteText("  记一笔  ")).toEqual({ valid: true, text: "记一笔" });
    });

    it("拒绝空文字、纯空白和非字符串", () => {
        for (const value of ["", "   ", "\n\t", undefined, null, 42]) {
            expect(normalizeInboxNoteText(value)).toEqual({ valid: false, reason: "text-empty" });
        }
    });

    it("按长度上限拒绝超长文字", () => {
        const tooLong = "字".repeat(MAX_INBOX_NOTE_TEXT_LENGTH + 1);
        expect(normalizeInboxNoteText(tooLong)).toEqual({ valid: false, reason: "text-too-long" });
        expect(normalizeInboxNoteText("字".repeat(MAX_INBOX_NOTE_TEXT_LENGTH)).valid).toBe(true);
    });
});

describe("parseInboxNote", () => {
    it("解析合法便条", () => {
        expect(parseInboxNote(NOTE)).toEqual(NOTE);
    });

    it("保留合法的完成时间", () => {
        const completed = { ...NOTE, completedAt: "2026-10-11T15:00:00.000Z" };
        expect(parseInboxNote(completed)).toEqual(completed);
    });

    it("丢弃缺字段、错类型和未知分级的条目", () => {
        const broken: unknown[] = [
            undefined,
            null,
            [],
            "text",
            { ...NOTE, id: "" },
            { ...NOTE, id: "   " },
            { ...NOTE, text: "   " },
            { ...NOTE, tier: "urgent" },
            { ...NOTE, tier: undefined },
            { ...NOTE, createdAt: "2026-10-11" },
            { ...NOTE, createdAt: "not-a-time" },
            { ...NOTE, completedAt: "2026-10-11" },
        ];
        for (const value of broken) {
            expect(parseInboxNote(value)).toBeUndefined();
        }
    });

    it("去掉首尾空白后再保存文字", () => {
        expect(parseInboxNote({ ...NOTE, text: "  订酒店  " })?.text).toBe("订酒店");
    });
});

describe("完成日期", () => {
    it("按本地日期判断完成归属日", () => {
        // 本地时间 2026-10-11 23:30 完成，应算作 10-11 完成，而不是 UTC 的 10-12
        const localLateNight = new Date(2026, 9, 11, 23, 30, 0);
        const note = { ...NOTE, completedAt: localLateNight.toISOString() };
        expect(getInboxNoteCompletedDate(note)).toBe("2026-10-11");
    });

    it("未完成时没有完成日期", () => {
        expect(getInboxNoteCompletedDate(NOTE)).toBeUndefined();
    });

    it("保留期内不清理，超出保留期才清理", () => {
        const note = { ...NOTE, completedAt: new Date(2026, 9, 5, 10, 0, 0).toISOString() };
        // 保留 7 天：today 为 10-11 时，10-05 已完成 6 天，仍在期内
        expect(isInboxNoteCompletionExpired(note, "2026-10-11", 7)).toBe(false);
        // today 为 10-12 时，10-05 已完成 7 天，超出保留期
        expect(isInboxNoteCompletionExpired(note, "2026-10-12", 7)).toBe(true);
    });

    it("跨月与跨年也按日历计算保留期", () => {
        const endOfMonth = { ...NOTE, completedAt: new Date(2026, 0, 31, 9, 0, 0).toISOString() };
        expect(isInboxNoteCompletionExpired(endOfMonth, "2026-02-06", 7)).toBe(false);
        expect(isInboxNoteCompletionExpired(endOfMonth, "2026-02-07", 7)).toBe(true);
        const endOfYear = { ...NOTE, completedAt: new Date(2026, 11, 31, 9, 0, 0).toISOString() };
        expect(isInboxNoteCompletionExpired(endOfYear, "2027-01-06", 7)).toBe(false);
        expect(isInboxNoteCompletionExpired(endOfYear, "2027-01-07", 7)).toBe(true);
    });

    it("尚未完成的便条永远不会过期", () => {
        expect(isInboxNoteCompletionExpired(NOTE, "2030-01-01", 7)).toBe(false);
    });
});

describe("splitInboxNoteText", () => {
    it("第一段是标题，其余是正文", () => {
        expect(splitInboxNoteText("Abstracts for Oct 20 From Don\n\nPAARE Colleagues,\n\nPlease get these to me soon."))
            .toEqual({
                title: "Abstracts for Oct 20 From Don",
                body: "PAARE Colleagues,\n\nPlease get these to me soon.",
            });
    });

    it("标题自己折了一行也不会被切开（按段落而不是按行）", () => {
        expect(splitInboxNoteText("很长的标题第一行\n标题第二行\n\n正文在此"))
            .toEqual({ title: "很长的标题第一行\n标题第二行", body: "正文在此" });
    });

    it("只有标题时正文为空", () => {
        expect(splitInboxNoteText("订 11 月会议期间住的酒店"))
            .toEqual({ title: "订 11 月会议期间住的酒店", body: "" });
    });

    it("兼容 CRLF 与首尾空行", () => {
        expect(splitInboxNoteText("\r\n标题\r\n\r\n正文\r\n"))
            .toEqual({ title: "标题", body: "正文" });
    });

    it("捕获框的「标题 + 空行 + 正文」拼起来再拆开，结果一致", () => {
        const title = "Abstracts for Oct 20 From Don";
        const body = "PAARE Colleagues,\n\nPlease get these to me soon.";
        expect(splitInboxNoteText(`${title}\n\n${body}`)).toEqual({ title, body });
    });

    it("空输入不会崩", () => {
        expect(splitInboxNoteText("")).toEqual({ title: "", body: "" });
        expect(splitInboxNoteText("   \n\n  ")).toEqual({ title: "", body: "" });
    });
});
