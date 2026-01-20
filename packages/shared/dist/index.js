// src/types.ts
var DEFAULT_CONFIG = {
  version: 1,
  memory: {
    enabled: true,
    maxEntries: 1e3,
    pruneAfterDays: 30
  },
  context: {
    maxTokens: 1e5,
    compactionThreshold: 0.8,
    autoCompact: true
  },
  tasks: {
    maxRetries: 3,
    retryDelay: 1e3,
    runTestsAfter: true,
    runLintAfter: true
  },
  parallel: {
    maxAgents: 3,
    useWorktrees: true,
    branchPrefix: "harness/"
  }
};
function mergeConfig(base, override) {
  return {
    ...base,
    ...override,
    memory: { ...base.memory, ...override.memory },
    context: { ...base.context, ...override.context },
    tasks: { ...base.tasks, ...override.tasks },
    parallel: { ...base.parallel, ...override.parallel }
  };
}

// src/memory-format.ts
import { randomUUID } from "crypto";
function createMemoryStore(projectId) {
  return {
    version: 1,
    projectId,
    lastUpdated: Date.now(),
    entries: []
  };
}
function createMemoryEntry(sessionId, type, content, importance = 0.5, metadata) {
  return {
    id: randomUUID(),
    timestamp: Date.now(),
    sessionId,
    type,
    content,
    importance: Math.max(0, Math.min(1, importance)),
    metadata
  };
}
function addMemoryEntry(store, entry) {
  return {
    ...store,
    lastUpdated: Date.now(),
    entries: [...store.entries, entry]
  };
}
function getRecentMemories(store, limit = 50) {
  return store.entries.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
function getImportantMemories(store, threshold = 0.7) {
  return store.entries.filter((e) => e.importance >= threshold).sort((a, b) => b.importance - a.importance);
}
function pruneOldMemories(store, maxAgeDays = 30) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1e3;
  const entries = store.entries.filter(
    (e) => e.timestamp > cutoff || e.importance > 0.8
  );
  return {
    ...store,
    lastUpdated: Date.now(),
    entries
  };
}
function compressMemories(store, sessionId) {
  const sessionEntries = store.entries.filter(
    (e) => e.sessionId === sessionId && e.type !== "summary"
  );
  if (sessionEntries.length < 10) {
    return store;
  }
  const decisions = sessionEntries.filter((e) => e.type === "decision");
  const findings = sessionEntries.filter((e) => e.type === "finding");
  const summaryContent = [
    decisions.length > 0 ? `Decisions: ${decisions.map((d) => d.content).join("; ")}` : "",
    findings.length > 0 ? `Findings: ${findings.map((f) => f.content).join("; ")}` : ""
  ].filter(Boolean).join("\n");
  const summary = createMemoryEntry(
    sessionId,
    "summary",
    summaryContent,
    0.9
  );
  const otherEntries = store.entries.filter((e) => e.sessionId !== sessionId);
  return {
    ...store,
    lastUpdated: Date.now(),
    entries: [...otherEntries, summary]
  };
}
function formatMemoriesForContext(memories, maxTokens = 2e3) {
  const lines = ["## Relevant Memories"];
  let estimatedTokens = 10;
  for (const memory of memories) {
    const line = `- [${memory.type}] ${memory.content}`;
    const lineTokens = Math.ceil(line.length / 4);
    if (estimatedTokens + lineTokens > maxTokens) break;
    lines.push(line);
    estimatedTokens += lineTokens;
  }
  return lines.join("\n");
}
export {
  DEFAULT_CONFIG,
  addMemoryEntry,
  compressMemories,
  createMemoryEntry,
  createMemoryStore,
  formatMemoriesForContext,
  getImportantMemories,
  getRecentMemories,
  mergeConfig,
  pruneOldMemories
};
