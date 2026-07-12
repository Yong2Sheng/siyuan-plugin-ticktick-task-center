import { fetchSyncPost, type IWebSocketData } from "siyuan";

export class SiYuanApiError extends Error {
    constructor(
        public readonly endpoint: string,
        public readonly code: number,
        message: string,
    ) {
        super(message);
        this.name = "SiYuanApiError";
    }
}

/**
 * Minimal typed boundary for official SiYuan HTTP APIs.
 * Business-specific block operations will be added only when their stage starts.
 */
export async function requestSiYuan<TResponse>(
    endpoint: string,
    payload: unknown = {},
): Promise<TResponse> {
    const response: IWebSocketData = await fetchSyncPost(endpoint, payload);

    if (response.code !== 0) {
        throw new SiYuanApiError(endpoint, response.code, response.msg || "SiYuan API request failed");
    }

    return response.data as TResponse;
}
