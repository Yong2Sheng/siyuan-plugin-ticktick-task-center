import { describe, expect, it, vi } from "vitest";

import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { loadTaskCenterData, TASK_CENTER_SQL } from "./task-center-query";

describe("task center SQL query", () => {
    it("returns one grouped row per task with all seven centralized attribute columns", () => {
        expect(TASK_CENTER_SQL).toContain("FROM attributes AS marker");
        expect(TASK_CENTER_SQL).toContain("JOIN blocks AS task");
        expect(TASK_CENTER_SQL).toContain(
            "GROUP BY task.id, task.root_id, task.box, task.hpath, document.content",
        );
        expect(TASK_CENTER_SQL).not.toContain("attribute.name AS attribute_name");
        expect(TASK_CENTER_SQL).not.toContain("attribute.value AS attribute_value");
        for (const attribute of Object.values(TASK_BLOCK_ATTRIBUTES)) {
            expect(TASK_CENTER_SQL).toContain(
                `MAX(CASE WHEN attribute.name = '${attribute}' THEN attribute.value END) AS "${attribute}"`,
            );
        }
        expect(TASK_CENTER_SQL.match(/MAX\(CASE WHEN attribute\.name = /g)).toHaveLength(7);
    });

    it("loads and aggregates with one SQL request", async () => {
        const query = vi.fn().mockResolvedValue([]);
        await expect(loadTaskCenterData(query)).resolves.toEqual({
            items: [],
            invalidBlocks: [],
            incompleteBlocks: [],
        });
        expect(query).toHaveBeenCalledOnce();
        expect(query).toHaveBeenCalledWith(TASK_CENTER_SQL);
    });
});
