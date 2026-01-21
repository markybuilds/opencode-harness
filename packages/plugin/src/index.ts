/**
 * OpenCode Harness Plugin
 * Full version with memory persistence
 */

import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

export const HarnessPlugin = async (ctx: {
    project?: { path?: string };
    path?: string;
    client?: { app?: { log?: (entry: unknown) => Promise<void> } };
    directory?: string;
    worktree?: string;
}) => {
    console.log("[Harness] Plugin loaded");

    // Get project path - DON'T use process.cwd() as fallback (might cause issues)
    const projectPath = ctx.project?.path || ctx.path || ctx.directory || ctx.worktree;

    // Simple tracking state
    const tracked = { files: 0, searches: 0, commands: 0 };

    // Memory save function (no initialization needed)
    const saveMemory = async () => {
        if (!projectPath) return;
        try {
            const memoryPath = join(projectPath, ".opencode", ".harness", "memory.json");
            await mkdir(dirname(memoryPath), { recursive: true });
            await writeFile(memoryPath, JSON.stringify({ tracked, savedAt: Date.now() }, null, 2));
            console.log("[Harness] Memory saved");
        } catch (err) {
            console.error("[Harness] Save error:", err);
        }
    };

    return {
        // Event hook
        async event({ event }: { event: { type: string } }) {
            if (event.type === "session.idle" || event.type === "session.end") {
                await saveMemory();
            }
        },

        // Tool execution hook
        async "tool.execute.after"(
            input: { tool: string },
            output: { args: Record<string, unknown> },
            result: string
        ) {
            const tool = input.tool;

            if (tool === "read") {
                tracked.files++;
            }
            if (tool === "grep" || tool === "search") {
                tracked.searches++;
            }
            if (tool === "bash" || tool === "shell") {
                tracked.commands++;
            }
        },
    };
};

export default HarnessPlugin;
