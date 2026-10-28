import { isTickTickTaskStatus, type TickTickTaskStatus } from "../domain/status";
import { isSiYuanId } from "../domain/siyuan-id";
import { TASK_BLOCK_ATTRIBUTES, TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";
import { readLocalDate } from "../domain/local-date";
import { querySiYuanSql, type SiYuanSqlRow } from "../siyuan/sql";

/**
 * 文档卡片上的「子项目」= `custom-ticktick-parent` 指向当前任务块的任务。
 *
 * 它们通常各自住在子文档里（由任务中心「新建子任务」创建），这里只读任务块属性，
 * 不额外保存副本，也不新增属性。卡片只需要标题、状态、截止三个字段，
 * 点开浮层时不再发请求。
 */
export type SubprojectSummary = {
    blockId: string;
    title: string;
    status: TickTickTaskStatus;
    deadline?: string;
    documentTitle: string;
    documentPath: string;
};

export type SubprojectQuery = (statement: string) => Promise<SiYuanSqlRow[]>;

export function buildSubprojectSql(parentBlockId: string): string {
    const attributeNames = [
        TASK_BLOCK_ATTRIBUTES.title,
        TASK_BLOCK_ATTRIBUTES.status,
        TASK_BLOCK_OPTIONAL_ATTRIBUTES.deadline,
    ].map((name) => `'${name}'`).join(", ");
    const titleColumn = TASK_BLOCK_ATTRIBUTES.title;
    const statusColumn = TASK_BLOCK_ATTRIBUTES.status;
    const deadlineColumn = TASK_BLOCK_OPTIONAL_ATTRIBUTES.deadline;
    return `SELECT
    task.id AS block_id,
    task.root_id AS root_id,
    task.hpath AS document_path,
    document.content AS document_title,
    MAX(CASE WHEN attribute.name = '${titleColumn}' THEN attribute.value END) AS title,
    MAX(CASE WHEN attribute.name = '${statusColumn}' THEN attribute.value END) AS status,
    MAX(CASE WHEN attribute.name = '${deadlineColumn}' THEN attribute.value END) AS deadline
FROM attributes AS parent
JOIN attributes AS attribute ON attribute.block_id = parent.block_id
JOIN blocks AS task ON task.id = parent.block_id
LEFT JOIN blocks AS document ON document.id = task.root_id
WHERE parent.name = '${TASK_BLOCK_OPTIONAL_ATTRIBUTES.parent}'
  AND parent.value = '${parentBlockId}'
  AND attribute.name IN (${attributeNames})
GROUP BY task.id, task.root_id, task.hpath, document.content
ORDER BY task.id`;
}

export function parseSubprojectRows(
    rows: readonly Readonly<Record<string, unknown>>[],
): SubprojectSummary[] {
    const result: SubprojectSummary[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        const blockId = readString(row.block_id);
        if (!isSiYuanId(blockId) || seen.has(blockId)) {
            continue;
        }
        const status = row.status;
        if (!isTickTickTaskStatus(status)) {
            continue;
        }
        const title = readString(row.title).trim();
        if (title === "") {
            continue;
        }
        const deadline = readLocalDate(row.deadline);
        result.push({
            blockId,
            title,
            status,
            ...(deadline ? { deadline } : {}),
            documentTitle: readString(row.document_title),
            documentPath: readString(row.document_path),
        });
        seen.add(blockId);
    }
    return result;
}

export async function loadSubprojects(
    parentBlockId: string,
    query: SubprojectQuery = querySiYuanSql,
): Promise<SubprojectSummary[]> {
    // 块 id 由思源生成，仍然先校验再拼进 SQL：这里不接受任何外部输入。
    if (!isSiYuanId(parentBlockId)) {
        return [];
    }
    const rows = await query(buildSubprojectSql(parentBlockId));
    return parseSubprojectRows(rows);
}

function readString(value: unknown): string {
    return typeof value === "string" ? value : "";
}
