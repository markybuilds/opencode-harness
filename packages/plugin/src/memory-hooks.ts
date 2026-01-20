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
export class MemoryHooks {
    private store: MemoryStore | null = null;
    private projectPath: string;
    private sessionId: string;
    private dirty: boolean = false;

    constructor(projectPath: string, sessionId: string) {
        this.projectPath = projectPath;
        this.sessionId = sessionId;
    }

    /**
     * Get the memory file path
     */
    private get memoryPath(): string {
        return join(this.projectPath, '.opencode', '.harness', 'memory.json');
    }

    /**
     * Initialize memory store (load from disk or create new)
     */
    async initialize(): Promise<void> {
        try {
            if (existsSync(this.memoryPath)) {
                const content = await readFile(this.memoryPath, 'utf-8');
                this.store = JSON.parse(content) as MemoryStore;

                // Prune old memories on load
                this.store = pruneOldMemories(this.store, 30);
                this.dirty = true;
            } else {
                this.store = createMemoryStore(this.getProjectId());
                this.dirty = true;
            }
        } catch (error) {
            console.error('[Harness] Error loading memory:', error);
            this.store = createMemoryStore(this.getProjectId());
            this.dirty = true;
        }
    }

    /**
     * Save memory store to disk
     */
    async persist(): Promise<void> {
        if (!this.store || !this.dirty) return;

        try {
            const dir = dirname(this.memoryPath);
            await mkdir(dir, { recursive: true });
            await writeFile(this.memoryPath, JSON.stringify(this.store, null, 2));
            this.dirty = false;
        } catch (error) {
            console.error('[Harness] Error saving memory:', error);
        }
    }

    /**
     * Add a decision memory
     */
    addDecision(content: string, importance: number = 0.8): void {
        this.addEntry('decision', content, importance);
    }

    /**
     * Add a finding memory
     */
    addFinding(content: string, importance: number = 0.6): void {
        this.addEntry('finding', content, importance);
    }

    /**
     * Add an error memory
     */
    addError(content: string, importance: number = 0.9): void {
        this.addEntry('error', content, importance);
    }

    /**
     * Add a preference memory
     */
    addPreference(content: string, importance: number = 0.7): void {
        this.addEntry('preference', content, importance);
    }

    /**
     * Add a context memory
     */
    addContext(content: string, importance: number = 0.5): void {
        this.addEntry('context', content, importance);
    }

    /**
     * Get memories formatted for LLM context
     */
    getContextString(maxTokens: number = 2000): string {
        if (!this.store) return '';

        const recent = getRecentMemories(this.store, 20);
        const important = getImportantMemories(this.store, 0.7);

        // Combine and deduplicate
        const combined = [...important, ...recent];
        const unique = combined.filter(
            (entry, index, self) =>
                index === self.findIndex((e) => e.id === entry.id)
        );

        return formatMemoriesForContext(unique, maxTokens);
    }

    /**
     * Get all memories for this session
     */
    getSessionMemories(): MemoryEntry[] {
        if (!this.store) return [];
        return this.store.entries.filter((e) => e.sessionId === this.sessionId);
    }

    /**
     * Search memories by content
     */
    searchMemories(query: string): MemoryEntry[] {
        if (!this.store) return [];
        const lowerQuery = query.toLowerCase();
        return this.store.entries.filter((e) =>
            e.content.toLowerCase().includes(lowerQuery)
        );
    }

    // Private methods

    private addEntry(
        type: MemoryEntry['type'],
        content: string,
        importance: number
    ): void {
        if (!this.store) return;

        const entry: MemoryEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            sessionId: this.sessionId,
            type,
            content,
            importance: Math.max(0, Math.min(1, importance)),
        };

        this.store = addMemoryEntry(this.store, entry);
        this.dirty = true;
    }

    private getProjectId(): string {
        // Use project path as unique identifier
        return this.projectPath
            .replace(/[\\/:]/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase();
    }
}
