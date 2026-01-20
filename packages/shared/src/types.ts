/**
 * OpenCode Harness - Shared Types
 * Core type definitions used across plugin and CLI packages
 */

// ============================================================================
// Memory & Context Types
// ============================================================================

/**
 * A single memory entry representing a piece of learned information
 */
export interface MemoryEntry {
    id: string;
    timestamp: number;
    sessionId: string;
    type: MemoryType;
    content: string;
    importance: number; // 0-1 scale
    metadata?: Record<string, unknown>;
}

export type MemoryType =
    | 'decision'      // User/AI decision made
    | 'finding'       // Code discovery or insight
    | 'error'         // Error encountered and resolution
    | 'preference'    // User preference learned
    | 'context'       // Important context to preserve
    | 'summary';      // Summarized older memories

/**
 * Memory store format persisted to disk
 */
export interface MemoryStore {
    version: 1;
    projectId: string;
    lastUpdated: number;
    entries: MemoryEntry[];
}

// ============================================================================
// Context Tracking Types (RLM-inspired)
// ============================================================================

/**
 * Tracks what the AI has "seen" in the current session
 */
export interface ContextItem {
    path: string;
    type: 'file' | 'function' | 'class' | 'search' | 'command';
    viewedAt: number;
    importance: number;
    summary?: string;
}

/**
 * Context tracker state
 */
export interface ContextState {
    items: ContextItem[];
    totalTokensEstimate: number;
    needsCompaction: boolean;
    lastCompactionAt?: number;
}

// ============================================================================
// Task & PRD Types
// ============================================================================

/**
 * A single task to be executed
 */
export interface Task {
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

export type TaskStatus =
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped';

/**
 * PRD/Task file parsed result
 */
export interface TaskList {
    source: string;
    format: 'markdown' | 'yaml' | 'inline';
    tasks: Task[];
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * OpenCode session configuration
 */
export interface SessionConfig {
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
export interface SessionState {
    id: string;
    status: 'idle' | 'running' | 'completed' | 'error';
    startedAt?: number;
    completedAt?: number;
    currentTask?: string;
    iterations: number;
    output: string[];
}

// ============================================================================
// IPC Messages (Plugin <-> CLI communication)
// ============================================================================

export type IPCMessage =
    | { type: 'memory.save'; payload: MemoryEntry }
    | { type: 'memory.load'; payload: { projectId: string } }
    | { type: 'context.update'; payload: ContextState }
    | { type: 'context.compact'; payload: { reason: string } }
    | { type: 'task.start'; payload: Task }
    | { type: 'task.complete'; payload: { taskId: string; success: boolean } };

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Harness configuration (stored in .opencode/.harness/config.json)
 */
export interface HarnessConfig {
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
export const DEFAULT_CONFIG: HarnessConfig = {
    version: 1,
    memory: {
        enabled: true,
        maxEntries: 1000,
        pruneAfterDays: 30,
    },
    context: {
        maxTokens: 100000,
        compactionThreshold: 0.8,
        autoCompact: true,
    },
    tasks: {
        maxRetries: 3,
        retryDelay: 1000,
        runTestsAfter: true,
        runLintAfter: true,
    },
    parallel: {
        maxAgents: 3,
        useWorktrees: true,
        branchPrefix: 'harness/',
    },
};

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function mergeConfig(
    base: HarnessConfig,
    override: DeepPartial<HarnessConfig>
): HarnessConfig {
    return {
        ...base,
        ...override,
        memory: { ...base.memory, ...override.memory },
        context: { ...base.context, ...override.context },
        tasks: { ...base.tasks, ...override.tasks },
        parallel: { ...base.parallel, ...override.parallel },
    } as HarnessConfig;
}
