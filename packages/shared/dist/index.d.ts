/**
 * OpenCode Harness - Shared Types
 * Core type definitions used across plugin and CLI packages
 */
/**
 * A single memory entry representing a piece of learned information
 */
interface MemoryEntry {
    id: string;
    timestamp: number;
    sessionId: string;
    type: MemoryType;
    content: string;
    importance: number;
    metadata?: Record<string, unknown>;
}
type MemoryType = 'decision' | 'finding' | 'error' | 'preference' | 'context' | 'summary';
/**
 * Memory store format persisted to disk
 */
interface MemoryStore {
    version: 1;
    projectId: string;
    lastUpdated: number;
    entries: MemoryEntry[];
}
/**
 * Tracks what the AI has "seen" in the current session
 */
interface ContextItem {
    path: string;
    type: 'file' | 'function' | 'class' | 'search' | 'command';
    viewedAt: number;
    importance: number;
    summary?: string;
}
/**
 * Context tracker state
 */
interface ContextState {
    items: ContextItem[];
    totalTokensEstimate: number;
    needsCompaction: boolean;
    lastCompactionAt?: number;
}
/**
 * A single task to be executed
 */
interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    parallelGroup?: number;
    dependencies?: string[];
    retries: number;
    maxRetries: number;
    createdAt: number;
    completedAt?: number;
    error?: string;
}
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
/**
 * PRD/Task file parsed result
 */
interface TaskList {
    source: string;
    format: 'markdown' | 'yaml' | 'inline';
    tasks: Task[];
}
/**
 * OpenCode session configuration
 */
interface SessionConfig {
    projectPath: string;
    maxIterations: number;
    timeout: number;
    runTests: boolean;
    runLint: boolean;
    verbose: boolean;
}
/**
 * Session state
 */
interface SessionState {
    id: string;
    status: 'idle' | 'running' | 'completed' | 'error';
    startedAt?: number;
    completedAt?: number;
    currentTask?: string;
    iterations: number;
    output: string[];
}
type IPCMessage = {
    type: 'memory.save';
    payload: MemoryEntry;
} | {
    type: 'memory.load';
    payload: {
        projectId: string;
    };
} | {
    type: 'context.update';
    payload: ContextState;
} | {
    type: 'context.compact';
    payload: {
        reason: string;
    };
} | {
    type: 'task.start';
    payload: Task;
} | {
    type: 'task.complete';
    payload: {
        taskId: string;
        success: boolean;
    };
};
/**
 * Harness configuration (stored in .opencode/.harness/config.json)
 */
interface HarnessConfig {
    version: 1;
    memory: {
        enabled: boolean;
        maxEntries: number;
        pruneAfterDays: number;
    };
    context: {
        maxTokens: number;
        compactionThreshold: number;
        autoCompact: boolean;
    };
    tasks: {
        maxRetries: number;
        retryDelay: number;
        runTestsAfter: boolean;
        runLintAfter: boolean;
    };
    parallel: {
        maxAgents: number;
        useWorktrees: boolean;
        branchPrefix: string;
    };
}
/**
 * Default configuration
 */
declare const DEFAULT_CONFIG: HarnessConfig;
type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
declare function mergeConfig(base: HarnessConfig, override: DeepPartial<HarnessConfig>): HarnessConfig;

/**
 * OpenCode Harness - Memory Format Utilities
 * Helpers for working with memory persistence
 */

/**
 * Create an empty memory store
 */
declare function createMemoryStore(projectId: string): MemoryStore;
/**
 * Create a new memory entry
 */
declare function createMemoryEntry(sessionId: string, type: MemoryType, content: string, importance?: number, metadata?: Record<string, unknown>): MemoryEntry;
/**
 * Add entry to store (immutable)
 */
declare function addMemoryEntry(store: MemoryStore, entry: MemoryEntry): MemoryStore;
/**
 * Get recent memories
 */
declare function getRecentMemories(store: MemoryStore, limit?: number): MemoryEntry[];
/**
 * Get high-importance memories
 */
declare function getImportantMemories(store: MemoryStore, threshold?: number): MemoryEntry[];
/**
 * Prune old memories beyond retention period
 */
declare function pruneOldMemories(store: MemoryStore, maxAgeDays?: number): MemoryStore;
/**
 * Compress memories into summaries
 * Groups memories by session and creates summary entries
 */
declare function compressMemories(store: MemoryStore, sessionId: string): MemoryStore;
/**
 * Format memories for LLM context
 */
declare function formatMemoriesForContext(memories: MemoryEntry[], maxTokens?: number): string;

export { type ContextItem, type ContextState, DEFAULT_CONFIG, type DeepPartial, type HarnessConfig, type IPCMessage, type MemoryEntry, type MemoryStore, type MemoryType, type SessionConfig, type SessionState, type Task, type TaskList, type TaskStatus, addMemoryEntry, compressMemories, createMemoryEntry, createMemoryStore, formatMemoriesForContext, getImportantMemories, getRecentMemories, mergeConfig, pruneOldMemories };
