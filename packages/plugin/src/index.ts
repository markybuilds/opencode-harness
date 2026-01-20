/**
 * OpenCode Harness Plugin
 * 
 * Main plugin entry point for OpenCode integration.
 * Provides RLM-style context management and memory persistence.
 */

import { createContextTracker } from './context-tracker.js';
import { createMemoryHooks } from './memory-hooks.js';
import { createContextNavTool } from './tools/context-nav.js';
import type { Plugin, PluginContext, PluginHooks } from './types.js';

// Re-export components for direct usage
export { createContextTracker, type ContextTracker } from './context-tracker.js';
export { createMemoryHooks, type MemoryHooks } from './memory-hooks.js';
export { createContextNavTool } from './tools/context-nav.js';
export type * from './types.js';

/**
 * OpenCode Harness Plugin
 * 
 * Features:
 * - RLM-style context tracking
 * - Session memory persistence
 * - Custom context navigation tool
 */
export const HarnessPlugin: Plugin = async (ctx: PluginContext): Promise<PluginHooks> => {
    const sessionId = crypto.randomUUID();
    const tracker = createContextTracker();
    const memory = createMemoryHooks(ctx.project.path, sessionId);

    // Initialize memory store
    await memory.initialize();

    // Log startup
    await ctx.client.app.log({
        service: 'harness-plugin',
        level: 'info',
        message: 'OpenCode Harness Plugin initialized',
        extra: { sessionId, projectPath: ctx.project.path },
    });

    return {
        // Handle events
        async event({ event }) {
            switch (event.type) {
                case 'session.start':
                    await ctx.client.app.log({
                        service: 'harness-plugin',
                        level: 'debug',
                        message: 'Session started',
                    });
                    break;

                case 'session.idle':
                case 'session.end':
                    // Persist memory when session ends
                    await memory.persist();
                    await ctx.client.app.log({
                        service: 'harness-plugin',
                        level: 'info',
                        message: 'Memory persisted on session end',
                    });
                    break;
            }
        },

        // Track tool executions
        async 'tool.execute.after'(input, _output, result) {
            const tool = input.tool;

            // Track file reads
            if (tool === 'read') {
                const filePath = (_output.args as { filePath?: string }).filePath;
                if (filePath) {
                    const tokens = Math.ceil(result.length / 4);
                    tracker.trackFile(filePath, tokens);
                }
            }

            // Track searches
            if (tool === 'grep' || tool === 'search') {
                const query = (_output.args as { query?: string }).query;
                if (query) {
                    const resultCount = (result.match(/\n/g) || []).length;
                    tracker.trackSearch(query, resultCount);
                }
            }

            // Track command executions
            if (tool === 'bash' || tool === 'shell') {
                const command = (_output.args as { command?: string }).command;
                if (command) {
                    const tokens = Math.ceil(result.length / 4);
                    tracker.trackCommand(command, tokens);
                }
            }

            // Check if compaction is needed
            const state = tracker.getState();
            if (state.needsCompaction) {
                await ctx.client.app.log({
                    service: 'harness-plugin',
                    level: 'warn',
                    message: 'Context approaching limit - consider compacting',
                    extra: { totalTokens: state.totalTokensEstimate },
                });
            }

            // Apply importance decay periodically
            tracker.applyDecay();
        },

        // Register custom tools
        tool: {
            'context-nav': createContextNavTool(tracker, memory, {
                string: () => ({ type: 'string' }),
                number: () => ({ type: 'number' }),
                boolean: () => ({ type: 'boolean' }),
                enum: <T extends string>(values: T[]) => ({ type: 'string' as const, enum: values }),
                optional: <T>(schema: T) => ({ ...schema, optional: true as const }),
            }),
        },
    };
};

// Default export for OpenCode plugin loading
export default HarnessPlugin;
