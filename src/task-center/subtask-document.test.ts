import { describe, expect, it, vi } from "vitest";

import type { TaskCenterItem } from "./task-center-data";
import {
    createSubtaskDocument,
    makeUniqueDocumentName,
    sanitizeDocumentName,
    SubtaskDocumentError,
    type SubtaskDocumentApi,
} from "./subtask-document";

const PARENT_ID = "20260713120000-abcdefg";
const PARENT_DOC = "/Projects/Proposal";
const NOTEBOOK_ID = "20260713100000-hijklmn";

function parentItem(): TaskCenterItem {
    return {
        blockId: PARENT_ID,
        rootId: "20260713110000-zyxwvut",
        notebookId: NOTEBOOK_ID,
        documentTitle: "Proposal",
        documentFilePath: "/20260713110000-zyxwvut.sy",
        documentPath: PARENT_DOC,
        title: "Write the proposal",
        url: "",
        status: "in-progress",
        createdAt: "2026-07-13T08:00:00.000Z",
        updatedAt: "2026-07-13T08:00:00.000Z",
    };
}

const TASK = {
    title: "Get Expectation Density",
    url: "https://dida365.com/task/1",
    status: "todo" as const,
    workMode: "explore" as const,
};

function createApi(
    existing: readonly { title: string }[] = [],
    createTaskBlock = vi.fn().mockResolvedValue({
        blockId: "20260713120001-bcdefgh",
        updatedAt: "2026-07-13T09:00:00.000Z",
    }),
): SubtaskDocumentApi & {
    createDocument: ReturnType<typeof vi.fn>;
    removeDocument: ReturnType<typeof vi.fn>;
    listChildDocuments: ReturnType<typeof vi.fn>;
    createTaskBlock: ReturnType<typeof vi.fn>;
    getChildBlocks: ReturnType<typeof vi.fn>;
    deleteBlock: ReturnType<typeof vi.fn>;
} {
    return {
        createDocument: vi.fn().mockResolvedValue("20260713120002-cdefghi"),
        removeDocument: vi.fn().mockResolvedValue(undefined),
        listChildDocuments: vi.fn().mockResolvedValue(existing),
        createTaskBlock,
        getChildBlocks: vi.fn().mockResolvedValue([]),
        deleteBlock: vi.fn().mockResolvedValue(undefined),
    };
}

describe("createSubtaskDocument", () => {
    it("creates a child document under the parent document and puts the task at its top", async () => {
        const api = createApi();
        const result = await createSubtaskDocument(api, parentItem(), TASK, "Task");

        expect(api.listChildDocuments).toHaveBeenCalledWith(
            NOTEBOOK_ID,
            "/20260713110000-zyxwvut.sy",
        );
        expect(api.createDocument).toHaveBeenCalledWith(
            NOTEBOOK_ID,
            `${PARENT_DOC}/Get Expectation Density`,
            "",
        );
        expect(api.createTaskBlock).toHaveBeenCalledWith({
            rootDocumentId: "20260713120002-cdefghi",
            parentBlockId: PARENT_ID,
            placement: "document-top",
            taskLabel: "Task",
            task: TASK,
        });
        expect(result).toEqual({
            documentId: "20260713120002-cdefghi",
            documentPath: `${PARENT_DOC}/Get Expectation Density`,
            documentName: "Get Expectation Density",
            blockId: "20260713120001-bcdefgh",
        });
    });

    it("removes the initial empty paragraph from the new child document", async () => {
        const api = createApi();
        api.getChildBlocks.mockResolvedValue([
            { id: "20260713120001-bcdefgh", type: "p", content: "Task" },
            { id: "20260713120003-defghij", type: "p", content: "  " },
        ]);

        await createSubtaskDocument(api, parentItem(), TASK, "Task");

        expect(api.deleteBlock).toHaveBeenCalledWith("20260713120003-defghij");
    });

    it("still creates the task when empty-paragraph cleanup fails", async () => {
        const api = createApi();
        api.getChildBlocks.mockRejectedValue(new Error("child list failed"));

        await expect(createSubtaskDocument(api, parentItem(), TASK, "Task"))
            .resolves.toMatchObject({ blockId: "20260713120001-bcdefgh" });
    });

    it("uses a suffixed document name when the child name already exists", async () => {
        const api = createApi([{ title: "Get Expectation Density" }]);
        await createSubtaskDocument(api, parentItem(), TASK, "Task");

        expect(api.createDocument).toHaveBeenCalledWith(
            NOTEBOOK_ID,
            `${PARENT_DOC}/Get Expectation Density 2`,
            "",
        );
    });

    it("removes the new document when the task block cannot be created", async () => {
        const createTaskBlock = vi.fn().mockRejectedValue(new Error("insert failed"));
        const api = createApi([], createTaskBlock);

        await expect(createSubtaskDocument(api, parentItem(), TASK, "Task"))
            .rejects.toMatchObject({ code: "block-create-failed" });
        expect(api.removeDocument).toHaveBeenCalledWith("20260713120002-cdefghi");
    });

    it("reports a rollback failure without pretending the document was removed", async () => {
        const createTaskBlock = vi.fn().mockRejectedValue(new Error("insert failed"));
        const api = createApi([], createTaskBlock);
        api.removeDocument.mockRejectedValue(new Error("remove failed"));

        await expect(createSubtaskDocument(api, parentItem(), TASK, "Task"))
            .rejects.toMatchObject({ code: "rollback-failed" });
    });

    it("rejects a parent without a notebook or document path", async () => {
        const api = createApi();
        const withoutNotebook = { ...parentItem(), notebookId: undefined };
        const withoutPath = { ...parentItem(), documentFilePath: "" };

        await expect(createSubtaskDocument(api, withoutNotebook, TASK, "Task"))
            .rejects.toMatchObject({ code: "missing-notebook" });
        await expect(createSubtaskDocument(api, withoutPath, TASK, "Task"))
            .rejects.toMatchObject({ code: "missing-document-path" });
        expect(api.createDocument).not.toHaveBeenCalled();
    });
});

describe("document names", () => {
    it("sanitizes path separators and control characters", () => {
        expect(sanitizeDocumentName("A/B\\C: D")).toBe("A／B／C／ D");
        expect(sanitizeDocumentName("   ")).toBe("Subtask");
    });

    it("keeps a unique suffix", () => {
        expect(makeUniqueDocumentName("Task", [])).toBe("Task");
        expect(makeUniqueDocumentName("Task", [{ title: "Task" }]))
            .toBe("Task 2");
        expect(makeUniqueDocumentName("Task", [{ title: "Task" }, { title: "Task 2" }]))
            .toBe("Task 3");
    });

    it("exposes a typed error class for callers", () => {
        expect(new SubtaskDocumentError("missing-notebook")).toMatchObject({
            name: "SubtaskDocumentError",
            code: "missing-notebook",
        });
    });
});
