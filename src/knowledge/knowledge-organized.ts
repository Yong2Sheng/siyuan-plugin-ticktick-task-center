import { isSiYuanId } from "../domain/siyuan-id";
import { querySiYuanSql, type SiYuanSqlRow } from "../siyuan/sql";

/** 已整理标记：布尔标识 + 整理时间，两者都写在知识文档块上。 */
export const KNOWLEDGE_ORGANIZED_ATTRIBUTE = "custom-task-center-knowledge-organized";
export const KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE = "custom-task-center-knowledge-organized-at";

export type KnowledgeOrganizedApi = {
    loadAttributes(blockId: string): Promise<Record<string, unknown>>;
    setAttributes(blockId: string, attrs: Record<string, string>): Promise<void>;
};

/** 读取并规范化整理时间；非法值视为未整理。 */
export function parseOrganizedAt(value: unknown): string | undefined {
    if (typeof value !== "string" || value.trim() === "") {
        return undefined;
    }
    const time = Date.parse(value);
    if (!Number.isFinite(time)) {
        return undefined;
    }
    return new Date(time).toISOString();
}

/**
 * 写入整理标记并读回复核。
 *
 * 时间戳是权威状态（扫描时以它恢复整理状态），布尔属性方便在思源里用 SQL
 * 或数据库视图直接查询；两者一起写。
 */
export async function writeKnowledgeOrganizedMark(
    api: KnowledgeOrganizedApi,
    blockId: string,
    organizedAt: string | Date,
): Promise<string> {
    const time = new Date(organizedAt);
    if (!Number.isFinite(time.getTime())) {
        throw new Error(`Invalid knowledge organized time for ${blockId}`);
    }
    const iso = time.toISOString();
    await api.setAttributes(blockId, {
        [KNOWLEDGE_ORGANIZED_ATTRIBUTE]: "true",
        [KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE]: iso,
    });

    const attributes = await api.loadAttributes(blockId);
    if (attributes[KNOWLEDGE_ORGANIZED_ATTRIBUTE] !== "true"
        || parseOrganizedAt(attributes[KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE]) !== iso) {
        throw new Error(`Knowledge organized mark verification failed for ${blockId}`);
    }
    return iso;
}

/** 清除整理标记并读回复核；思源里用空字符串删除自定义属性。 */
export async function clearKnowledgeOrganizedMark(
    api: KnowledgeOrganizedApi,
    blockId: string,
): Promise<void> {
    await api.setAttributes(blockId, {
        [KNOWLEDGE_ORGANIZED_ATTRIBUTE]: "",
        [KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE]: "",
    });

    const attributes = await api.loadAttributes(blockId);
    if (readAttribute(attributes, KNOWLEDGE_ORGANIZED_ATTRIBUTE) !== ""
        || readAttribute(attributes, KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE) !== "") {
        throw new Error(`Knowledge organized mark removal failed for ${blockId}`);
    }
}

/**
 * 扫描时批量读取整理标记。
 *
 * 只查一次 attributes 表，避免按文档逐篇调用 attr API；
 * 时间戳缺失或非法的记录按未整理处理。
 */
export async function loadKnowledgeOrganizedMarks(
    query: (statement: string) => Promise<SiYuanSqlRow[]> = querySiYuanSql,
): Promise<Map<string, string>> {
    const rows = await query(
        `SELECT block_id, value FROM attributes WHERE name = '${KNOWLEDGE_ORGANIZED_AT_ATTRIBUTE}'`,
    );
    const marks = new Map<string, string>();
    for (const row of rows) {
        const blockId = row.block_id;
        const organizedAt = parseOrganizedAt(row.value);
        if (typeof blockId === "string" && isSiYuanId(blockId) && organizedAt) {
            marks.set(blockId, organizedAt);
        }
    }
    return marks;
}

function readAttribute(attributes: Record<string, unknown>, name: string): string {
    const value = attributes[name];
    return typeof value === "string" ? value.trim() : "";
}
