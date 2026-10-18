/**
 * 任务权重（优先级）——活跃任务排序的第二维度。
 *
 * 背景：截止日期在很多任务上只是自己给自己定的软日期，过期也没有真实代价，
 * 因此不能作为唯一排序依据。权重表达「这件事本身有多重要」，不随日期流逝而衰减；
 * 排序时权重优先，截止日期只用于同一档位内的先后。
 *
 * 未设置权重的任务（包括加入本字段之前的全部旧任务）一律按「正常推进」处理，
 * 因此老数据不需要迁移。属性值留空字符串表示「未设置」。
 */
export const TASK_PRIORITY_IDS = ["high", "normal", "low"] as const;

export type TickTickTaskPriority = (typeof TASK_PRIORITY_IDS)[number];

export type TaskPriorityConfig = {
    icon: string;
    labelKey: `priority.${string}`;
};

export const TASK_PRIORITY_CONFIG = {
    high: { icon: "🔥", labelKey: "priority.high" },
    normal: { icon: "➖", labelKey: "priority.normal" },
    low: { icon: "☕", labelKey: "priority.low" },
} as const satisfies Record<TickTickTaskPriority, TaskPriorityConfig>;

/** 未设置权重时归入的档位。 */
export const DEFAULT_TASK_PRIORITY: TickTickTaskPriority = "normal";

/**
 * 排序用的档位序号：数字小的排在前面。
 * 用显式映射而不是数组下标，避免依赖声明顺序被无意改动。
 */
const PRIORITY_ORDERS: Record<TickTickTaskPriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
};

export function isTickTickTaskPriority(value: unknown): value is TickTickTaskPriority {
    return typeof value === "string"
        && (TASK_PRIORITY_IDS as readonly string[]).includes(value);
}

/**
 * 把可选的权重解析为排序档位：未设置时返回默认档位。
 * 注意：这里只处理「未设置」，非法值必须在解析边界就被拒绝，不能走到这里。
 */
export function resolveTaskPriority(
    priority: TickTickTaskPriority | undefined,
): TickTickTaskPriority {
    return priority ?? DEFAULT_TASK_PRIORITY;
}

export function getTaskPriorityOrder(priority: TickTickTaskPriority): number {
    return PRIORITY_ORDERS[priority];
}

/** 序列化为属性值：未设置写空字符串，与「清除可选字段」的既有语义一致。 */
export function serializeTaskPriority(
    priority: TickTickTaskPriority | undefined,
): string {
    return priority ?? "";
}

/**
 * 解析属性值：缺失或空字符串表示未设置；非法值返回 undefined 并标记为无效，
 * 由调用方决定是拒绝整个任务块还是忽略。
 */
export function parseTaskPriorityAttribute(
    value: unknown,
): { valid: true; priority?: TickTickTaskPriority } | { valid: false } {
    if (value === undefined || value === "") {
        return { valid: true };
    }
    if (!isTickTickTaskPriority(value)) {
        return { valid: false };
    }
    return { valid: true, priority: value };
}

/**
 * 表单选项：在三个真实档位之外补一个「未设置」，让用户能把权重清回未设状态。
 * 这一项的值是空字符串，因此选中它等于清空属性——与「正常推进」在排序上等价，
 * 但界面上保留区分，避免「我明明设过」的困惑。
 */
export function withUnsetPriorityChoice(
    translate: (key: string) => string,
): Array<{ value: TickTickTaskPriority | ""; text: string }> {
    return [
        ...TASK_PRIORITY_IDS.map((id) => ({
            value: id as TickTickTaskPriority | "",
            text: `${TASK_PRIORITY_CONFIG[id].icon} ${translate(TASK_PRIORITY_CONFIG[id].labelKey)}`,
        })),
        { value: "", text: translate("priority.unset") },
    ];
}
