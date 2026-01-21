/**
 * OpenCode Harness Plugin
 * Full version with memory persistence
 */
declare const HarnessPlugin: (ctx: {
    project?: {
        path?: string;
    };
    path?: string;
    client?: {
        app?: {
            log?: (entry: unknown) => Promise<void>;
        };
    };
    directory?: string;
    worktree?: string;
}) => Promise<{
    event({ event }: {
        event: {
            type: string;
        };
    }): Promise<void>;
    "tool.execute.after"(input: {
        tool: string;
    }, output: {
        args: Record<string, unknown>;
    }, result: string): Promise<void>;
}>;

export { HarnessPlugin, HarnessPlugin as default };
