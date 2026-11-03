type MessageId = 'missingId' | 'derivedWithoutId' | 'idMismatch';
interface RequireModelIdOptions {
    /**
     * `src/models/v2024_01_01/shared/checkout.ts` under root `src/models` expects ids
     * starting with `V2024_01_01_Shared_Checkout`: path segments joined by `_`.
     */
    readonly idFromPath?: {
        readonly root: string;
        /** `pascal` (default) capitalizes each `-` or `.` separated word of a segment, `preserve` keeps the segment. */
        readonly case?: 'pascal' | 'preserve';
    };
}
interface RuleContext {
    readonly filename: string;
    readonly cwd: string;
    readonly options: readonly unknown[];
    report(descriptor: {
        node: unknown;
        messageId: MessageId;
        data?: Record<string, string>;
    }): void;
}
interface RuleModule {
    readonly meta: {
        readonly type: 'problem';
        readonly docs: {
            readonly description: string;
        };
        readonly messages: Readonly<Record<MessageId, string>>;
        readonly schema: readonly unknown[];
    };
    create(context: RuleContext): Record<string, (node: any) => void>;
}
declare const requireModelId: RuleModule;

declare const plugin: {
    readonly meta: {
        readonly name: "t-rest";
    };
    readonly rules: {
        readonly 'require-model-id': RuleModule;
    };
};

export { plugin as default, requireModelId };
export type { MessageId, RequireModelIdOptions, RuleContext, RuleModule };
