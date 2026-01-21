// src/index.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
function createTracker() {
  const state = { items: [], totalTokens: 0 };
  return {
    trackFile(path, tokens) {
      state.items.push({ path, type: "file", viewedAt: Date.now(), tokens });
      state.totalTokens += tokens;
    },
    trackSearch(query, resultCount) {
      state.items.push({ path: query, type: "search", viewedAt: Date.now(), tokens: resultCount * 10 });
    },
    trackCommand(cmd, tokens) {
      state.items.push({ path: cmd, type: "command", viewedAt: Date.now(), tokens });
      state.totalTokens += tokens;
    },
    getState() {
      return state;
    }
  };
}
async function createMemory(projectPath, sessionId) {
  const memoryPath = join(projectPath, ".opencode", ".harness", "memory.json");
  let entries = [];
  async function load() {
    try {
      if (existsSync(memoryPath)) {
        const data = await readFile(memoryPath, "utf-8");
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
    }
  }
  return { load, save, entries };
}
var HarnessPlugin = async (ctx) => {
  const sessionId = crypto.randomUUID();
  const projectPath = ctx.project?.path || ctx.path || process.cwd();
  const tracker = createTracker();
  const memory = await createMemory(projectPath, sessionId);
  await memory.load();
  const log = async (message) => {
    try {
      if (ctx.client?.app?.log) {
        await ctx.client.app.log({ service: "harness", level: "info", message });
      }
    } catch {
    }
  };
  await log("Harness Plugin initialized");
  return {
    async event({ event }) {
      if (event.type === "session.idle" || event.type === "session.end") {
        await memory.save();
        await log("Memory saved");
      }
    },
    async "tool.execute.after"(input, output, result) {
      const tool = input.tool;
      if (tool === "read") {
        const filePath = output.args?.filePath;
        if (filePath) {
          tracker.trackFile(filePath, Math.ceil(result.length / 4));
        }
      }
      if (tool === "grep" || tool === "search") {
        const query = output.args?.query;
        if (query) {
          tracker.trackSearch(query, (result.match(/\n/g) || []).length);
        }
      }
      if (tool === "bash" || tool === "shell") {
        const command = output.args?.command;
        if (command) {
          tracker.trackCommand(command, Math.ceil(result.length / 4));
        }
      }
    }
  };
};
var index_default = HarnessPlugin;
export {
  HarnessPlugin,
  index_default as default
};
