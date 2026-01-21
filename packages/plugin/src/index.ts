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

    // Get project path with fallbacks
    const projectPath = ctx.project?.path || ctx.path || process.cwd();

    const memory = createMemoryHooks(projectPath, sessionId);

    // Helper for safe logging
    const log = async (level: 'debug' | 'info' | 'warn' | 'error', message: string, extra?: Record<string, unknown>) => {
        try {
            if (ctx.client?.app?.log) {
                await ctx.client.app.log({ service: 'harness-plugin', level, message, extra });
            }
        } catch {
            // Ignore logging errors
        }
    };

    // Initialize memory store (with error handling)
    try {
        await memory.initialize();
    } catch (err) {
        await log('error', 'Failed to initialize memory store', { error: String(err) });
    }

    // Log startup (non-blocking)
    log('info', 'OpenCode Harness Plugin initialized', { sessionId, projectPath });

    return {
        // Handle events
        async event({ event }) {
            switch (event.type) {
                case 'session.start':
                    await log('debug', 'Session started');
                    break;

                case 'session.idle':
                case 'session.end':
                    // Persist memory when session ends
                    try {
                        await memory.persist();
                        await log('info', 'Memory persisted on session end');
                    } catch {
                        // Ignore persist errors
                    }
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
                log('warn', 'Context approaching limit - consider compacting', { totalTokens: state.totalTokensEstimate });
            }

            // Apply importance decay periodically
            tracker.applyDecay();
        },

        // Custom tools disabled for now - requires @opencode-ai/plugin package
        // TODO: Re-enable when proper integration with official plugin package is done
        // tool: {
        //     'context-nav': createContextNavTool(tracker, memory, schema),
        // },
    };
};

// Default export for OpenCode plugin loading
export default HarnessPlugin;
