export type SubmissionResult<TResult> =
    | { accepted: true; value: TResult }
    | { accepted: false };

export class SubmissionController<TInput, TResult> {
    private cancelled = false;
    private submitting = false;

    constructor(private readonly handler: (input: TInput) => Promise<TResult>) {}

    cancel(): void {
        this.cancelled = true;
    }

    async submit(input: TInput): Promise<SubmissionResult<TResult>> {
        if (this.cancelled || this.submitting) {
            return { accepted: false };
        }

        this.submitting = true;
        try {
            return { accepted: true, value: await this.handler(input) };
        } finally {
            this.submitting = false;
        }
    }
}
