/**
 * OpenCode Harness Plugin - Context Navigation Tool
 * Custom tool for programmatic context exploration (RLM-style)
 */

import type { ContextTracker } from '../context-tracker.js';
import type { MemoryHooks } from '../memory-hooks.js';

/**
 * Tool schema type (compatible with @opencode-ai/plugin)
 */
interface ToolSchema {
    string: () => { type: 'string' };
    number: () => { type: 'number' };
    boolean: () => { type: 'boolean' };
    enum: <T extends string>(values: T[]) => { type: 'string'; enum: T[] };
    optional: <T>(schema: T) => T & { optional: true };
}

/**
 * Tool definition type
 */
interface ToolDefinition<TArgs> {
    description: string;
    args: TArgs;
    execute: (args: { [K in keyof TArgs]: unknown }, ctx: unknown) => Promise<string>;
}

/**
 * Create the context-nav tool definition
 */
export function createContextNavTool(
    tracker: ContextTracker,
    memory: MemoryHooks,
    schema: ToolSchema
): ToolDefinition<Record<string, unknown>> {
    return {
        description: `Navigate and explore the context state. Use this to:
- View what files/functions have been seen
- Check if specific files were already read
- Get memory of past sessions
- Understand current context usage

Actions:
- "status": Show context state summary
- "seen": Check if a path was already viewed
- "recent": List recently viewed items
- "important": List high-importance items
- "memory": Get relevant memories
- "search": Search memories for a term`,

        args: {
            action: schema.enum([
                'status',
                'seen',
                'recent',
                'important',
                'memory',
                'search',
            ]),
            path: schema.optional(schema.string()),
            query: schema.optional(schema.string()),
            limit: schema.optional(schema.number()),
        },

        async execute(args): Promise<string> {
            const action = args.action as string;
            const path = args.path as string | undefined;
            const query = args.query as string | undefined;
            const limit = (args.limit as number) || 10;

            switch (action) {
                case 'status':
                    return formatStatus(tracker);

                case 'seen':
                    if (!path) return '❌ Error: path is required for "seen" action';
                    const seen = tracker.hasSeen(path);
                    return seen
                        ? `✅ Already viewed: ${path}`
                        : `❌ Not yet viewed: ${path}`;

                case 'recent':
                    return formatRecent(tracker, limit);

                case 'important':
                    return formatImportant(tracker, limit);

                case 'memory':
                    return memory.getContextString(2000);

                case 'search':
                    if (!query) return '❌ Error: query is required for "search" action';
                    return formatSearch(memory, query);

                default:
                    return `❌ Unknown action: ${action}`;
            }
        },
    };
}

// Formatting helpers

function formatStatus(tracker: ContextTracker): string {
    const state = tracker.getState();
    const lines = [
        '## Context Status',
        '',
        `**Items Tracked:** ${state.items.length}`,
        `**Estimated Tokens:** ${state.totalTokensEstimate.toLocaleString()}`,
        `**Needs Compaction:** ${state.needsCompaction ? '⚠️ Yes' : '✅ No'}`,
    ];

    if (state.lastCompactionAt) {
        const ago = Math.round((Date.now() - state.lastCompactionAt) / 60000);
        lines.push(`**Last Compaction:** ${ago} minutes ago`);
    }

    lines.push('', '---', '', tracker.formatForPrompt());

    return lines.join('\n');
}

function formatRecent(tracker: ContextTracker, limit: number): string {
    const items = tracker.getRecent(limit);
    if (items.length === 0) return 'No items viewed yet.';

    const lines = ['## Recently Viewed', ''];
    for (const item of items) {
        const ago = Math.round((Date.now() - item.viewedAt) / 60000);
        lines.push(`- **${item.type}**: ${item.path} _(${ago}m ago)_`);
    }

    return lines.join('\n');
}

function formatImportant(tracker: ContextTracker, limit: number): string {
    const items = tracker.getByImportance().slice(0, limit);
    if (items.length === 0) return 'No items tracked yet.';

    const lines = ['## High Importance Items', ''];
    for (const item of items) {
        const pct = (item.importance * 100).toFixed(0);
        lines.push(`- [${pct}%] **${item.type}**: ${item.path}`);
    }

    return lines.join('\n');
}

function formatSearch(memory: MemoryHooks, query: string): string {
    const results = memory.searchMemories(query);
    if (results.length === 0) return `No memories found for: "${query}"`;

    const lines = [`## Memory Search: "${query}"`, '', `Found ${results.length} results:`, ''];
    for (const entry of results.slice(0, 10)) {
        const date = new Date(entry.timestamp).toLocaleDateString();
        lines.push(`- [${entry.type}] ${entry.content} _(${date})_`);
    }

    return lines.join('\n');
}
