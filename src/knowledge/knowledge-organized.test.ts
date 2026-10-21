import { describe, expect, it, vi } from "vitest";

import {
    KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE,
    KNOWLEDGE_ORGANIZED_ATTRIBUTE,
    clearKnowledgeOrganizedMark,
    loadKnowledgeOrganizedMarks,
    parseOrganizedAt,
    writeKnowledgeOrganizedMark,
} from "./knowledge-organized";

const BLOCK_ID = "20260901100000-abcdefg";
const ORGANIZED_AT = "2026-09-02T12:00:00.000Z";

describe("knowledge organized mark", () => {
    it("normalizes valid timestamps and rejects malformed values", () => {
        expect(parseOrganizedAt("2026-09-02T12:00:00Z")).toBe(ORGANIZED_AT);
        expect(parseOrganizedAt("")).toBeUndefined();
        expect(parseOrganizedAt("not-a-date")).toBeUndefined();
        expect(parseOrganizedAt(undefined)).toBeUndefined();
    });

    it("writes both attributes and verifies them by reading back", async () => {
        const setAttributes = vi.fn().mockResolvedValue(undefined);
        const loadAttributes = vi.fn().mockResolvedValue({
            [KNOWLEDGE_ORGANIZED_ATTRIBUTE]: "true",
            [KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE]: ORGANIZED_AT,
        });

        await expect(writeKnowledgeOrganizedMark(
            { loadAttributes, setAttributes },
            BLOCK_ID,
            ORGANIZED_AT,
        )).resolves.toBe(ORGANIZED_AT);

        expect(setAttributes).toHaveBeenCalledWith(BLOCK_ID, {
            [KNOWLEDGE_ORGANIZED_ATTRIBUTE]: "true",
            [KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE]: ORGANIZED_AT,
        });
        expect(loadAttributes).toHaveBeenCalledWith(BLOCK_ID);
    });

    it("fails when the written mark cannot be read back", async () => {
        await expect(writeKnowledgeOrganizedMark({
            setAttributes: vi.fn().mockResolvedValue(undefined),
            loadAttributes: vi.fn().mockResolvedValue({
                [KNOWLEDGE_ORGANIZED_ATTRIBUTE]: "true",
            }),
        }, BLOCK_ID, ORGANIZED_AT)).rejects.toThrow("verification failed");
    });

    it("clears both attributes and accepts removed or empty values", async () => {
        const setAttributes = vi.fn().mockResolvedValue(undefined);
        await clearKnowledgeOrganizedMark({
            setAttributes,
            loadAttributes: vi.fn().mockResolvedValue({}),
        }, BLOCK_ID);
        expect(setAttributes).toHaveBeenCalledWith(BLOCK_ID, {
            [KNOWLEDGE_ORGANIZED_ATTRIBUTE]: "",
            [KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE]: "",
        });

        await clearKnowledgeOrganizedMark({
            setAttributes,
            loadAttributes: vi.fn().mockResolvedValue({
                [KNOWLEDGE_ORGANIZED_ATTRIBUTE]: "",
                [KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE]: "",
            }),
        }, BLOCK_ID);
    });

    it("fails when the mark survives the clear request", async () => {
        await expect(clearKnowledgeOrganizedMark({
            setAttributes: vi.fn().mockResolvedValue(undefined),
            loadAttributes: vi.fn().mockResolvedValue({
                [KNOWLEDGE_ORGANIZED_ATTRIBUTE]: "true",
                [KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE]: ORGANIZED_AT,
            }),
        }, BLOCK_ID)).rejects.toThrow("removal failed");
    });

    it("batches marks from the attributes table and drops invalid rows", async () => {
        const query = vi.fn().mockResolvedValue([
            { block_id: BLOCK_ID, value: "2026-09-02T12:00:00Z" },
            { block_id: "bad-id", value: ORGANIZED_AT },
            { block_id: "20260901110000-hijklmn", value: "not-a-date" },
            { block_id: 42, value: ORGANIZED_AT },
        ]);

        const marks = await loadKnowledgeOrganizedMarks(query);

        expect(marks).toEqual(new Map([[BLOCK_ID, ORGANIZED_AT]]));
        expect(query).toHaveBeenCalledOnce();
        expect(query.mock.calls[0]?.[0]).toContain(KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE);
    });
});
