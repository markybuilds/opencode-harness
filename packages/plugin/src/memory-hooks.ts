/**
 * OpenCode Harness Plugin - Memory Hooks
 * Session memory persistence hooks
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import {
    type MemoryStore,
    type MemoryEntry,
    createMemoryStore,
    addMemoryEntry,
    pruneOldMemories,
    getRecentMemories,
    getImportantMemories,
    formatMemoriesForContext,
} from '@opencode-harness/shared';

/**
 * Memory Hooks - Session persistence layer
 * 
 * Handles loading/saving memory to disk and provides
 * hooks for the OpenCode plugin system.
 */
export function createMemoryHooks(projectPath: string, sessionId: string) {
    let store: MemoryStore | null = null;
    let dirty = false;

    /**
     * Get the memory file path
     */
    const memoryPath = join(projectPath, '.opencode', '.harness', 'memory.json');

    function getProjectId(): string {
        return projectPath.replace(/[\\/:]/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    }

    /**
     * Initialize memory store (load from disk or create new)
     */
    async function initialize(): Promise<void> {
        try {
            if (existsSync(memoryPath)) {
                const content = await readFile(memoryPath, 'utf-8');
                store = JSON.parse(content);
                // Prune old memories on load (keep last 30 days)
                store = pruneOldMemories(store!, 30);
                dirty = true;
            } else {
                store = createMemoryStore(getProjectId());
                dirty = true;
            }
        } catch (error) {
            console.error('[Harness] Error loading memory:', error);
            // Fallback to new store
            store = createMemoryStore(getProjectId());
            dirty = true;
        }
    }

    /**
     * Save memory store to disk
     */
    async function persist(): Promise<void> {
        if (!store || !dirty) return;

        try {
            const dir = dirname(memoryPath);
            await mkdir(dir, { recursive: true });
            await writeFile(memoryPath, JSON.stringify(store, null, 2));
            dirty = false;
        } catch (error) {
            console.error('[Harness] Error saving memory:', error);
        }
    }

    function addEntry(type: MemoryEntry['type'], content: string, importance: number): void {
        if (!store) return;

        const entry: MemoryEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            sessionId: sessionId,
            type,
            content,
            importance: Math.max(0, Math.min(1, importance)),
        };

        store = addMemoryEntry(store, entry);
        dirty = true;
    }

    /**
     * Add a decision memory
     */
    function addDecision(content: string, importance: number = 0.8): void {
        addEntry('decision', content, importance);
    }

    /**
     * Add a finding memory
     */
    function addFinding(content: string, importance: number = 0.6): void {
        addEntry('finding', content, importance);
    }

    /**
     * Add an error memory
     */
    function addError(content: string, importance: number = 0.9): void {
        addEntry('error', content, importance);
    }

    /**
     * Add a preference memory
     */
    function addPreference(content: string, importance: number = 0.7): void {
        addEntry('preference', content, importance);
    }

    /**
     * Add a context memory
     */
    function addContext(content: string, importance: number = 0.5): void {
        addEntry('context', content, importance);
    }

    /**
     * Get memories formatted for LLM context
     */
    function getContextString(maxTokens: number = 2000): string {
        if (!store) return '';

        const recent = getRecentMemories(store, 20);
        const important = getImportantMemories(store, 0.7);

        // Dedup and combine
        const combined = [...important, ...recent];
        const unique = combined.filter((entry, index, self) =>
            index === self.findIndex((e) => e.id === entry.id)
        );

        return formatMemoriesForContext(unique, maxTokens);
    }

    /**
     * Get all memories for this session
     */
    function getSessionMemories(): MemoryEntry[] {
        if (!store) return [];
        return store.entries.filter((e) => e.sessionId === sessionId);
    }

    /**
     * Search memories by content
     */
    function searchMemories(query: string): MemoryEntry[] {
        if (!store) return [];
        const lowerQuery = query.toLowerCase();
        return store.entries.filter((e) =>
            e.content.toLowerCase().includes(lowerQuery)
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

export type MemoryHooks = ReturnType<typeof createMemoryHooks>;
