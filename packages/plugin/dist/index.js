// src/index.ts
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
var HarnessPlugin = async (ctx) => {
  console.log("[Harness] Plugin loaded");
  const projectPath = ctx.project?.path || ctx.path || ctx.directory || ctx.worktree;
  const tracked = { files: 0, searches: 0, commands: 0 };
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
    async event({ event }) {
      if (event.type === "session.idle" || event.type === "session.end") {
        await saveMemory();
      }
    },
    // Tool execution hook
    async "tool.execute.after"(input, output, result) {
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
    }
  };
};
var index_default = HarnessPlugin;
export {
  HarnessPlugin,
  index_default as default
};
