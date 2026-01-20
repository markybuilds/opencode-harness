/**
 * OpenCode Harness - Memory Format Utilities
 * Helpers for working with memory persistence
 */

import { randomUUID } from 'crypto';
import type { MemoryEntry, MemoryStore, MemoryType } from './types.js';

/**
 * Create an empty memory store
 */
export function createMemoryStore(projectId: string): MemoryStore {
    return {
        version: 1,
        projectId,
        lastUpdated: Date.now(),
        entries: [],
    };
}

/**
 * Create a new memory entry
 */
export function createMemoryEntry(
    sessionId: string,
    type: MemoryType,
    content: string,
    importance: number = 0.5,
    metadata?: Record<string, unknown>
): MemoryEntry {
    return {
        id: randomUUID(),
        timestamp: Date.now(),
        sessionId,
        type,
        content,
        importance: Math.max(0, Math.min(1, importance)),
        metadata,
    };
}

/**
 * Add entry to store (immutable)
 */
export function addMemoryEntry(
    store: MemoryStore,
    entry: MemoryEntry
): MemoryStore {
    return {
        ...store,
        lastUpdated: Date.now(),
        entries: [...store.entries, entry],
    };
}

/**
 * Get recent memories
 */
export function getRecentMemories(
    store: MemoryStore,
    limit: number = 50
): MemoryEntry[] {
    return store.entries
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
}

/**
 * Get high-importance memories
 */
export function getImportantMemories(
    store: MemoryStore,
    threshold: number = 0.7
): MemoryEntry[] {
    return store.entries
        .filter((e) => e.importance >= threshold)
        .sort((a, b) => b.importance - a.importance);
}

/**
 * Prune old memories beyond retention period
 */
export function pruneOldMemories(
    store: MemoryStore,
    maxAgeDays: number = 30
): MemoryStore {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    // Keep high-importance memories even if old
    const entries = store.entries.filter(
        (e) => e.timestamp > cutoff || e.importance > 0.8
    );

    return {
        ...store,
        lastUpdated: Date.now(),
        entries,
    };
}

/**
 * Compress memories into summaries
 * Groups memories by session and creates summary entries
 */
export function compressMemories(
    store: MemoryStore,
    sessionId: string
): MemoryStore {
    const sessionEntries = store.entries.filter(
        (e) => e.sessionId === sessionId && e.type !== 'summary'
    );

    if (sessionEntries.length < 10) {
        return store; // Not enough to compress
    }

    // Create summary of the session
    const decisions = sessionEntries.filter((e) => e.type === 'decision');
    const findings = sessionEntries.filter((e) => e.type === 'finding');

    const summaryContent = [
        decisions.length > 0 ? `Decisions: ${decisions.map((d) => d.content).join('; ')}` : '',
        findings.length > 0 ? `Findings: ${findings.map((f) => f.content).join('; ')}` : '',
    ]
        .filter(Boolean)
        .join('\n');

    const summary = createMemoryEntry(
        sessionId,
        'summary',
        summaryContent,
        0.9
    );

    // Remove old entries, keep summary
    const otherEntries = store.entries.filter((e) => e.sessionId !== sessionId);

    return {
        ...store,
        lastUpdated: Date.now(),
        entries: [...otherEntries, summary],
    };
}

/**
 * Format memories for LLM context
 */
export function formatMemoriesForContext(
    memories: MemoryEntry[],
    maxTokens: number = 2000
): string {
    const lines: string[] = ['## Relevant Memories'];
    let estimatedTokens = 10;

    for (const memory of memories) {
        const line = `- [${memory.type}] ${memory.content}`;
        const lineTokens = Math.ceil(line.length / 4);

        if (estimatedTokens + lineTokens > maxTokens) break;

        lines.push(line);
        estimatedTokens += lineTokens;
    }

    return lines.join('\n');
}
