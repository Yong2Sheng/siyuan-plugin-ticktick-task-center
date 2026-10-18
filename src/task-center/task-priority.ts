import {
    DEFAULT_TASK_PRIORITY,
    serializeTaskPriority,
    type TickTickTaskPriority,
} from "../domain/priority";
import { TASK_BLOCK_OPTIONAL_ATTRIBUTES } from "../domain/task";

export type TaskPriorityApi = {
    loadAttributes(blockId: string): Promise<Record<string, unknown>>;
    setBlockAttributes(blockId: string, attributes: Record<string, string>): Promise<void>;
};

/**
 * 保存任务权重。
 *
 * 只写权重属性，不触碰 updatedAt：权重是任务的长期属性，改它不应该让任务在
 * 「按更新时间」的视图里跳到最前面，也不应该触发编辑冲突检测。
 *
 * 「正常推进」与「未设置」语义等同，因此这一档不落库成 "normal"，而是清空属性。
 * 这样存储层只有两种状态：某一档，或空；解析时把空读成「正常推进」。
 */
export async function saveTaskPriority(
    api: TaskPriorityApi,
    blockId: string,
    priority: TickTickTaskPriority,
): Promise<void> {
    const serialized = priority === DEFAULT_TASK_PRIORITY
        ? ""
        : serializeTaskPriority(priority);
    await api.setBlockAttributes(blockId, {
        [TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority]: serialized,
    });

    // 写后复核：与今日推进、重点安排保持同一套「不信写入结果」的做法。
    const verified = await api.loadAttributes(blockId);
    const stored = verified[TASK_BLOCK_OPTIONAL_ATTRIBUTES.priority];
    if ((stored ?? "") !== serialized) {
        throw new Error(`Task priority verification failed for ${blockId}`);
    }
}
