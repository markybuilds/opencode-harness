/**
 * OpenCode Harness Plugin
 * 
 * A minimal plugin for OpenCode that tracks context and persists memory.
 * No custom tools - just hooks for tracking.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

// Simple in-memory context tracker
interface ContextItem {
    path: string;
    type: 'file' | 'search' | 'command';
    viewedAt: number;
    tokens: number;
}

interface ContextState {
    items: ContextItem[];
    totalTokens: number;
}

function createTracker() {
    const state: ContextState = { items: [], totalTokens: 0 };

    return {
        trackFile(path: string, tokens: number) {
            state.items.push({ path, type: 'file', viewedAt: Date.now(), tokens });
            state.totalTokens += tokens;
        },
        trackSearch(query: string, resultCount: number) {
            state.items.push({ path: query, type: 'search', viewedAt: Date.now(), tokens: resultCount * 10 });
        },
        trackCommand(cmd: string, tokens: number) {
            state.items.push({ path: cmd, type: 'command', viewedAt: Date.now(), tokens });
            state.totalTokens += tokens;
        },
        getState() { return state; }
    };
}

// Simple memory persistence
async function createMemory(projectPath: string, sessionId: string) {
    const memoryPath = join(projectPath, '.opencode', '.harness', 'memory.json');
    let entries: Array<{ type: string; content: string; timestamp: number }> = [];

    async function load() {
        try {
            if (existsSync(memoryPath)) {
                const data = await readFile(memoryPath, 'utf-8');
                entries = JSON.parse(data).entries || [];
            }
        } catch {
            entries = [];
        }
    }

    async function save() {
        try {
            await mkdir(dirname(memoryPath), { recursive: true });
            await writeFile(memoryPath, JSON.stringify({ sessionId, entries }, null, 2));
        } catch {
            // Ignore save errors
        }
    }

    return { load, save, entries };
}

// Plugin type (minimal)
type PluginContext = {
    project?: { path?: string };
    path?: string;
    client?: { app?: { log?: (entry: unknown) => Promise<void> } };
};

type PluginHooks = {
    event?: (ctx: { event: { type: string } }) => Promise<void>;
    'tool.execute.after'?: (input: { tool: string }, output: { args: Record<string, unknown> }, result: string) => Promise<void>;
};

/**
 * OpenCode Harness Plugin
 */
export const HarnessPlugin = async (ctx: PluginContext): Promise<PluginHooks> => {
    const sessionId = crypto.randomUUID();
    const projectPath = ctx.project?.path || ctx.path || process.cwd();
    const tracker = createTracker();
    const memory = await createMemory(projectPath, sessionId);

    // Load existing memory
    await memory.load();

    // Safe logging helper
    const log = async (message: string) => {
        try {
            if (ctx.client?.app?.log) {
                await ctx.client.app.log({ service: 'harness', level: 'info', message });
            }
        } catch {
            // Silent fail
        }
    };

    await log('Harness Plugin initialized');

    return {
        async event({ event }) {
            if (event.type === 'session.idle' || event.type === 'session.end') {
                await memory.save();
                await log('Memory saved');
            }
        },

        async 'tool.execute.after'(input, output, result) {
            const tool = input.tool;

            if (tool === 'read') {
                const filePath = output.args?.filePath as string;
                if (filePath) {
                    tracker.trackFile(filePath, Math.ceil(result.length / 4));
                }
            }

            if (tool === 'grep' || tool === 'search') {
                const query = output.args?.query as string;
                if (query) {
                    tracker.trackSearch(query, (result.match(/\n/g) || []).length);
                }
            }

            if (tool === 'bash' || tool === 'shell') {
                const command = output.args?.command as string;
                if (command) {
                    tracker.trackCommand(command, Math.ceil(result.length / 4));
                }
            }
        },
    };
};

// Default export for OpenCode
export default HarnessPlugin;
