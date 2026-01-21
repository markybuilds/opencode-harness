/**
 * OpenCode Harness Plugin
 *
 * A minimal plugin for OpenCode that tracks context and persists memory.
 * No custom tools - just hooks for tracking.
 */
type PluginContext = {
    project?: {
        path?: string;
    };
    path?: string;
    client?: {
        app?: {
            log?: (entry: unknown) => Promise<void>;
        };
    };
};
type PluginHooks = {
    event?: (ctx: {
        event: {
            type: string;
        };
    }) => Promise<void>;
    'tool.execute.after'?: (input: {
        tool: string;
    }, output: {
        args: Record<string, unknown>;
    }, result: string) => Promise<void>;
};
/**
 * OpenCode Harness Plugin
 */
declare const HarnessPlugin: (ctx: PluginContext) => Promise<PluginHooks>;

export { HarnessPlugin, HarnessPlugin as default };
