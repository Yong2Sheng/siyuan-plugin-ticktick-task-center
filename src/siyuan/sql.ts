import { requestSiYuan } from "./api";

export type SiYuanSqlRow = Record<string, unknown>;

export async function querySiYuanSql(statement: string): Promise<SiYuanSqlRow[]> {
    const response = await requestSiYuan<unknown>("/api/query/sql", {
        stmt: statement,
    });
    if (!Array.isArray(response) || !response.every(isRecord)) {
        throw new Error("SiYuan querySQL response was not an array of rows");
    }
    return response;
}

function isRecord(value: unknown): value is SiYuanSqlRow {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
