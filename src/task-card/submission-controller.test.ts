import { describe, expect, it, vi } from "vitest";

import { SubmissionController } from "./submission-controller";

describe("SubmissionController", () => {
    it("does not invoke the handler after cancellation", async () => {
        const handler = vi.fn().mockResolvedValue("created");
        const controller = new SubmissionController(handler);
        controller.cancel();

        await expect(controller.submit("input")).resolves.toEqual({ accepted: false });
        expect(handler).not.toHaveBeenCalled();
    });

    it("ignores a repeated submit while creation is in flight", async () => {
        let resolveCreation: ((value: string) => void) | undefined;
        const handler = vi.fn(() => new Promise<string>((resolve) => {
            resolveCreation = resolve;
        }));
        const controller = new SubmissionController(handler);

        const first = controller.submit("input");
        await expect(controller.submit("input")).resolves.toEqual({ accepted: false });
        expect(handler).toHaveBeenCalledOnce();

        resolveCreation?.("created");
        await expect(first).resolves.toEqual({ accepted: true, value: "created" });
    });
});
