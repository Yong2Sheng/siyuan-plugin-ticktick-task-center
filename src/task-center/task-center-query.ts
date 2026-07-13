import { TASK_BLOCK_ATTRIBUTES } from "../domain/task";
import { querySiYuanSql, type SiYuanSqlRow } from "../siyuan/sql";
import { aggregateTaskCenterRows, type TaskCenterAggregationResult } from "./task-center-data";

const attributeNames = Object.values(TASK_BLOCK_ATTRIBUTES)
    .map((name) => `'${name}'`)
    .join(", ");

const attributeColumns = Object.values(TASK_BLOCK_ATTRIBUTES)
    .map((name) => `    MAX(CASE WHEN attribute.name = '${name}' THEN attribute.value END) AS "${name}"`)
    .join(",\n");

export const TASK_CENTER_SQL = `SELECT
    task.id AS block_id,
    task.root_id AS root_id,
    task.box AS notebook_id,
    task.hpath AS document_path,
    document.content AS document_title,
${attributeColumns}
FROM attributes AS marker
JOIN attributes AS attribute ON attribute.block_id = marker.block_id
JOIN blocks AS task ON task.id = marker.block_id
LEFT JOIN blocks AS document ON document.id = task.root_id
WHERE marker.name = '${TASK_BLOCK_ATTRIBUTES.card}'
  AND marker.value = 'true'
  AND attribute.name IN (${attributeNames})
GROUP BY task.id, task.root_id, task.box, task.hpath, document.content
ORDER BY task.id`;

export type TaskCenterQuery = (statement: string) => Promise<SiYuanSqlRow[]>;

export async function loadTaskCenterData(
    query: TaskCenterQuery = querySiYuanSql,
): Promise<TaskCenterAggregationResult> {
    const rows = await query(TASK_CENTER_SQL);
    return aggregateTaskCenterRows(rows);
}
