export function isSiYuanId(value: unknown): value is string {
    return typeof value === "string" && /^\d{14}-[a-z0-9]{7}$/.test(value);
}
