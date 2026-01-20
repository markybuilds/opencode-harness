import { ContextState, ContextItem, MemoryEntry } from '@opencode-harness/shared';

/**
 * OpenCode Harness Plugin - Types
 * Plugin-specific type definitions
 */
/**
 * Plugin context provided by OpenCode
 */
interface PluginContext {
    project: {
        path: string;
        name: string;
    };
    directory: string;
    worktree: string;
    client: {
        app: {
            log: (entry: LogEntry) => Promise<void>;
        };
    };
    $: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{
        stdout: string;
        stderr: string;
    }>;
}
interface LogEntry {
    service: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    extra?: Record<string, unknown>;
}
/**
 * Plugin hooks interface
 */
interface PluginHooks {
    event?: (ctx: {
        event: PluginEvent;
    }) => Promise<void>;
    'tool.execute.before'?: (input: ToolInput, output: ToolOutput) => Promise<void>;
    'tool.execute.after'?: (input: ToolInput, output: ToolOutput, result: string) => Promise<void>;
    tool?: Record<string, ToolDefinition$1>;
}
interface PluginEvent {
    type: string;
    [key: string]: unknown;
}
interface ToolInput {
    tool: string;
    sessionId: string;
}
interface ToolOutput {
    args: Record<string, unknown>;
}
interface ToolDefinition$1 {
    description: string;
    args: Record<string, unknown>;
    execute: (args: Record<string, unknown>, ctx: unknown) => Promise<string>;
}
/**
 * Plugin function signature
 */
type Plugin = (ctx: PluginContext) => Promise<PluginHooks>;

/**
 * OpenCode Harness Plugin - Context Tracker
 * RLM-inspired context state machine for tracking what the AI has "seen"
 */

/**
 * Configuration for context tracker
 */
interface ContextTrackerConfig {
    maxTokens: number;
    compactionThreshold: number;
    importanceDecayRate: number;
}
/**
 * Context Tracker - RLM-inspired state machine
 *
 * Tracks what files, functions, and search results the AI has viewed.
 * Calculates importance scores and signals when compaction is needed.
 */
/**
 * Context Tracker - RLM-inspired state machine
 *
 * Tracks what files, functions, and search results the AI has viewed.
 * Calculates importance scores and signals when compaction is needed.
 */
declare function createContextTracker(initialConfig?: Partial<ContextTrackerConfig>): {
    trackFile: (path: string, tokens: number, summary?: string) => void;
    trackSymbol: (path: string, symbolName: string, tokens: number) => void;
    trackSearch: (query: string, resultCount: number) => void;
    trackCommand: (command: string, outputTokens: number) => void;
    getState: () => ContextState;
    reset: () => void;
    hasSeen: (path: string) => boolean;
    getRecent: (limit?: number) => ContextItem[];
    getImportant: () => ContextItem[];
    applyDecay: () => void;
    prune: (importanceThreshold?: number) => ContextItem[];
    markCompacted: () => void;
    formatForPrompt: () => string;
};
type ContextTracker = ReturnType<typeof createContextTracker>;

/**
 * OpenCode Harness Plugin - Memory Hooks
 * Session memory persistence hooks
 */

/**
 * Memory Hooks - Session persistence layer
 *
 * Handles loading/saving memory to disk and provides
 * hooks for the OpenCode plugin system.
 */
declare function createMemoryHooks(projectPath: string, sessionId: string): {
    initialize: () => Promise<void>;
    persist: () => Promise<void>;
    addDecision: (content: string, importance?: number) => void;
    addFinding: (content: string, importance?: number) => void;
    addError: (content: string, importance?: number) => void;
    addPreference: (content: string, importance?: number) => void;
    addContext: (content: string, importance?: number) => void;
    getContextString: (maxTokens?: number) => string;
    getSessionMemories: () => MemoryEntry[];
    searchMemories: (query: string) => MemoryEntry[];
};
type MemoryHooks = ReturnType<typeof createMemoryHooks>;

/**
 * OpenCode Harness Plugin - Context Navigation Tool
 * Custom tool for programmatic context exploration (RLM-style)
 */

/**
 * Tool schema type (compatible with @opencode-ai/plugin)
 */
interface ToolSchema {
    string: () => {
        type: 'string';
    };
    number: () => {
        type: 'number';
    };
    boolean: () => {
        type: 'boolean';
    };
    enum: <T extends string>(values: T[]) => {
        type: 'string';
        enum: T[];
    };
    optional: <T>(schema: T) => T & {
        optional: true;
    };
}
/**
 * Tool definition type
 */
interface ToolDefinition<TArgs> {
    description: string;
    args: TArgs;
    execute: (args: {
        [K in keyof TArgs]: unknown;
    }, ctx: unknown) => Promise<string>;
}
/**
 * Create the context-nav tool definition
 */
declare function createContextNavTool(tracker: ContextTracker, memory: MemoryHooks, schema: ToolSchema): ToolDefinition<Record<string, unknown>>;

/**
 * OpenCode Harness Plugin
 *
 * Main plugin entry point for OpenCode integration.
 * Provides RLM-style context management and memory persistence.
 */

/**
 * OpenCode Harness Plugin
 *
 * Features:
 * - RLM-style context tracking
 * - Session memory persistence
 * - Custom context navigation tool
 */
declare const HarnessPlugin: Plugin;

export { type ContextTracker, HarnessPlugin, type LogEntry, type MemoryHooks, type Plugin, type PluginContext, type PluginEvent, type PluginHooks, type ToolDefinition$1 as ToolDefinition, type ToolInput, type ToolOutput, createContextNavTool, createContextTracker, createMemoryHooks, HarnessPlugin as default };
