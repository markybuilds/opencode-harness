// src/context-tracker.ts
var DEFAULT_CONFIG = {
  maxTokens: 1e5,
  compactionThreshold: 0.8,
  importanceDecayRate: 0.95
};
function createContextTracker(initialConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...initialConfig };
  let state = {
    items: [],
    totalTokensEstimate: 0,
    needsCompaction: false
  };
  function trackFile(path, tokens, summary) {
    addItem({
      path,
      type: "file",
      viewedAt: Date.now(),
      importance: calculateImportance("file"),
      summary
    }, tokens);
  }
  function trackSymbol(path, symbolName, tokens) {
    addItem({
      path: `${path}#${symbolName}`,
      type: "function",
      viewedAt: Date.now(),
      importance: calculateImportance("function")
    }, tokens);
  }
  function trackSearch(query, resultCount) {
    addItem({
      path: `search:${query}`,
      type: "search",
      viewedAt: Date.now(),
      importance: calculateImportance("search"),
      summary: `${resultCount} results`
    }, 100);
  }
  function trackCommand(command, outputTokens) {
    addItem({
      path: `cmd:${command.substring(0, 50)}`,
      type: "command",
      viewedAt: Date.now(),
      importance: calculateImportance("command")
    }, outputTokens);
  }
  function getState() {
    return { ...state };
  }
  function getByImportance() {
    return [...state.items].sort((a, b) => b.importance - a.importance);
  }
  function getRecent(limit = 10) {
    return [...state.items].sort((a, b) => b.viewedAt - a.viewedAt).slice(0, limit);
  }
  function hasSeen(path) {
    return state.items.some((item) => item.path === path);
  }
  function markCompacted() {
    state = {
      ...state,
      needsCompaction: false,
      lastCompactionAt: Date.now()
    };
  }
  function applyDecay() {
    state = {
      ...state,
      items: state.items.map((item) => ({
        ...item,
        importance: item.importance * config.importanceDecayRate
      }))
    };
  }
  function prune(importanceThreshold = 0.1) {
    const removed = state.items.filter(
      (item) => item.importance < importanceThreshold
    );
    state = {
      ...state,
      items: state.items.filter(
        (item) => item.importance >= importanceThreshold
      ),
      totalTokensEstimate: state.items.reduce(
        (sum, item) => sum + estimateTokens(item),
        0
      )
    };
    checkCompactionNeeded();
    return removed;
  }
  function formatForPrompt() {
    const items = getByImportance().slice(0, 20);
    const lines = [
      "## Context Navigator",
      "",
      "**Recently Viewed:**",
      ...getRecent(5).map(
        (item) => `- ${item.type}: ${item.path}`
      ),
      "",
      "**High Importance:**",
      ...items.slice(0, 5).map(
        (item) => `- [${(item.importance * 100).toFixed(0)}%] ${item.path}`
      )
    ];
    if (state.needsCompaction) {
      lines.push("", "\u26A0\uFE0F **Context approaching limit - consider compacting**");
    }
    return lines.join("\n");
  }
  function addItem(item, tokens) {
    const existingIndex = state.items.findIndex(
      (i) => i.path === item.path
    );
    if (existingIndex >= 0) {
      const existing = state.items[existingIndex];
      state.items[existingIndex] = {
        ...existing,
        viewedAt: item.viewedAt,
        importance: Math.min(1, existing.importance + 0.1),
        summary: item.summary || existing.summary
      };
    } else {
      state.items.push(item);
      state.totalTokensEstimate += tokens;
    }
    checkCompactionNeeded();
  }
  function calculateImportance(type) {
    const baseImportance = {
      file: 0.7,
      function: 0.8,
      class: 0.8,
      search: 0.5,
      command: 0.6
    };
    return baseImportance[type] ?? 0.5;
  }
  function estimateTokens(item) {
    const tokenEstimates = {
      file: 500,
      function: 200,
      class: 400,
      search: 100,
      command: 150
    };
    return tokenEstimates[item.type] ?? 100;
  }
  function checkCompactionNeeded() {
    const ratio = state.totalTokensEstimate / config.maxTokens;
    state.needsCompaction = ratio >= config.compactionThreshold;
  }
  function reset() {
    state = {
      items: [],
      totalTokensEstimate: 0,
      needsCompaction: false
    };
  }
  function getImportant() {
    return getByImportance();
  }
  return {
    trackFile,
    trackSymbol,
    trackSearch,
    trackCommand,
    getState,
    reset,
    hasSeen,
    getRecent,
    getImportant,
    applyDecay,
    prune,
    markCompacted,
    formatForPrompt
  };
}

// src/memory-hooks.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import {
  createMemoryStore,
  addMemoryEntry,
  pruneOldMemories,
  getRecentMemories,
  getImportantMemories,
  formatMemoriesForContext
} from "@opencode-harness/shared";
function createMemoryHooks(projectPath, sessionId) {
  let store = null;
  let dirty = false;
  const memoryPath = join(projectPath, ".opencode", ".harness", "memory.json");
  function getProjectId() {
    return projectPath.replace(/[\\/:]/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  }
  async function initialize() {
    try {
      if (existsSync(memoryPath)) {
        const content = await readFile(memoryPath, "utf-8");
        store = JSON.parse(content);
        store = pruneOldMemories(store, 30);
        dirty = true;
      } else {
        store = createMemoryStore(getProjectId());
        dirty = true;
      }
    } catch (error) {
      console.error("[Harness] Error loading memory:", error);
      store = createMemoryStore(getProjectId());
      dirty = true;
    }
  }
  async function persist() {
    if (!store || !dirty) return;
    try {
      const dir = dirname(memoryPath);
      await mkdir(dir, { recursive: true });
      await writeFile(memoryPath, JSON.stringify(store, null, 2));
      dirty = false;
    } catch (error) {
      console.error("[Harness] Error saving memory:", error);
    }
  }
  function addEntry(type, content, importance) {
    if (!store) return;
    const entry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sessionId,
      type,
      content,
      importance: Math.max(0, Math.min(1, importance))
    };
    store = addMemoryEntry(store, entry);
    dirty = true;
  }
  function addDecision(content, importance = 0.8) {
    addEntry("decision", content, importance);
  }
  function addFinding(content, importance = 0.6) {
    addEntry("finding", content, importance);
  }
  function addError(content, importance = 0.9) {
    addEntry("error", content, importance);
  }
  function addPreference(content, importance = 0.7) {
    addEntry("preference", content, importance);
  }
  function addContext(content, importance = 0.5) {
    addEntry("context", content, importance);
  }
  function getContextString(maxTokens = 2e3) {
    if (!store) return "";
    const recent = getRecentMemories(store, 20);
    const important = getImportantMemories(store, 0.7);
    const combined = [...important, ...recent];
    const unique = combined.filter(
      (entry, index, self) => index === self.findIndex((e) => e.id === entry.id)
    );
    return formatMemoriesForContext(unique, maxTokens);
  }
  function getSessionMemories() {
    if (!store) return [];
    return store.entries.filter((e) => e.sessionId === sessionId);
  }
  function searchMemories(query) {
    if (!store) return [];
    const lowerQuery = query.toLowerCase();
    return store.entries.filter(
      (e) => e.content.toLowerCase().includes(lowerQuery)
    );
  }
  return {
    initialize,
    persist,
    addDecision,
    addFinding,
    addError,
    addPreference,
    addContext,
    getContextString,
    getSessionMemories,
    searchMemories
  };
}

// src/tools/context-nav.ts
function createContextNavTool(tracker, memory, schema) {
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
        "status",
        "seen",
        "recent",
        "important",
        "memory",
        "search"
      ]),
      path: schema.optional(schema.string()),
      query: schema.optional(schema.string()),
      limit: schema.optional(schema.number())
    },
    async execute(args) {
      const action = args.action;
      const path = args.path;
      const query = args.query;
      const limit = args.limit || 10;
      switch (action) {
        case "status":
          return formatStatus(tracker);
        case "seen":
          if (!path) return '\u274C Error: path is required for "seen" action';
          const seen = tracker.hasSeen(path);
          return seen ? `\u2705 Already viewed: ${path}` : `\u274C Not yet viewed: ${path}`;
        case "recent":
          return formatRecent(tracker, limit);
        case "important":
          return formatImportant(tracker, limit);
        case "memory":
          return memory.getContextString(2e3);
        case "search":
          if (!query) return '\u274C Error: query is required for "search" action';
          return formatSearch(memory, query);
        default:
          return `\u274C Unknown action: ${action}`;
      }
    }
  };
}
function formatStatus(tracker) {
  const state = tracker.getState();
  const lines = [
    "## Context Status",
    "",
    `**Items Tracked:** ${state.items.length}`,
    `**Estimated Tokens:** ${state.totalTokensEstimate.toLocaleString()}`,
    `**Needs Compaction:** ${state.needsCompaction ? "\u26A0\uFE0F Yes" : "\u2705 No"}`
  ];
  if (state.lastCompactionAt) {
    const ago = Math.round((Date.now() - state.lastCompactionAt) / 6e4);
    lines.push(`**Last Compaction:** ${ago} minutes ago`);
  }
  lines.push("", "---", "", tracker.formatForPrompt());
  return lines.join("\n");
}
function formatRecent(tracker, limit) {
  const items = tracker.getRecent(limit);
  if (items.length === 0) return "No items viewed yet.";
  const lines = ["## Recently Viewed", ""];
  for (const item of items) {
    const ago = Math.round((Date.now() - item.viewedAt) / 6e4);
    lines.push(`- **${item.type}**: ${item.path} _(${ago}m ago)_`);
  }
  return lines.join("\n");
}
function formatImportant(tracker, limit) {
  const items = tracker.getImportant().slice(0, limit);
  if (items.length === 0) return "No items tracked yet.";
  const lines = ["## High Importance Items", ""];
  for (const item of items) {
    const pct = (item.importance * 100).toFixed(0);
    lines.push(`- [${pct}%] **${item.type}**: ${item.path}`);
  }
  return lines.join("\n");
}
function formatSearch(memory, query) {
  const results = memory.searchMemories(query);
  if (results.length === 0) return `No memories found for: "${query}"`;
  const lines = [`## Memory Search: "${query}"`, "", `Found ${results.length} results:`, ""];
  for (const entry of results.slice(0, 10)) {
    const date = new Date(entry.timestamp).toLocaleDateString();
    lines.push(`- [${entry.type}] ${entry.content} _(${date})_`);
  }
  return lines.join("\n");
}

// src/index.ts
var HarnessPlugin = async (ctx) => {
  const sessionId = crypto.randomUUID();
  const tracker = createContextTracker();
  const projectPath = ctx.project?.path || ctx.path || process.cwd();
  const memory = createMemoryHooks(projectPath, sessionId);
  const log = async (level, message, extra) => {
    try {
      if (ctx.client?.app?.log) {
        await ctx.client.app.log({ service: "harness-plugin", level, message, extra });
      }
    } catch {
    }
  };
  try {
    await memory.initialize();
  } catch (err) {
    await log("error", "Failed to initialize memory store", { error: String(err) });
  }
  log("info", "OpenCode Harness Plugin initialized", { sessionId, projectPath });
  return {
    // Handle events
    async event({ event }) {
      switch (event.type) {
        case "session.start":
          await log("debug", "Session started");
          break;
        case "session.idle":
        case "session.end":
          try {
            await memory.persist();
            await log("info", "Memory persisted on session end");
          } catch {
          }
          break;
      }
    },
    // Track tool executions
    async "tool.execute.after"(input, _output, result) {
      const tool = input.tool;
      if (tool === "read") {
        const filePath = _output.args.filePath;
        if (filePath) {
          const tokens = Math.ceil(result.length / 4);
          tracker.trackFile(filePath, tokens);
        }
      }
      if (tool === "grep" || tool === "search") {
        const query = _output.args.query;
        if (query) {
          const resultCount = (result.match(/\n/g) || []).length;
          tracker.trackSearch(query, resultCount);
        }
      }
      if (tool === "bash" || tool === "shell") {
        const command = _output.args.command;
        if (command) {
          const tokens = Math.ceil(result.length / 4);
          tracker.trackCommand(command, tokens);
        }
      }
      const state = tracker.getState();
      if (state.needsCompaction) {
        log("warn", "Context approaching limit - consider compacting", { totalTokens: state.totalTokensEstimate });
      }
      tracker.applyDecay();
    }
    // Custom tools disabled for now - requires @opencode-ai/plugin package
    // TODO: Re-enable when proper integration with official plugin package is done
    // tool: {
    //     'context-nav': createContextNavTool(tracker, memory, schema),
    // },
  };
};
var index_default = HarnessPlugin;
export {
  HarnessPlugin,
  createContextNavTool,
  createContextTracker,
  createMemoryHooks,
  index_default as default
};
