/**
 * OpenCode Harness Plugin - Types
 * Plugin-specific type definitions
 */

/**
 * Plugin context provided by OpenCode
 */
export interface PluginContext {
    project?: {
        path?: string;
        name?: string;
    };
    path?: string;
    directory?: string;
    worktree?: string;
    client: {
        app: {
            log: (entry: LogEntry) => Promise<void>;
        };
    };
    $: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ stdout: string; stderr: string }>;
}

export interface LogEntry {
    service: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    extra?: Record<string, unknown>;
}

/**
 * Plugin hooks interface
 */
export interface PluginHooks {
    event?: (ctx: { event: PluginEvent }) => Promise<void>;
    'tool.execute.before'?: (input: ToolInput, output: ToolOutput) => Promise<void>;
    'tool.execute.after'?: (input: ToolInput, output: ToolOutput, result: string) => Promise<void>;
    tool?: Record<string, ToolDefinition>;
}

export interface PluginEvent {
    type: string;
    [key: string]: unknown;
}

export interface ToolInput {
    tool: string;
    sessionId: string;
}

export interface ToolOutput {
    args: Record<string, unknown>;
}

export interface ToolDefinition {
    description: string;
    args: Record<string, unknown>;
    execute: (args: Record<string, unknown>, ctx: unknown) => Promise<string>;
}

/**
 * Plugin function signature
 */
export type Plugin = (ctx: PluginContext) => Promise<PluginHooks>;
