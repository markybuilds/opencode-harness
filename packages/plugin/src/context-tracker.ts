/**
 * OpenCode Harness Plugin - Context Tracker
 * RLM-inspired context state machine for tracking what the AI has "seen"
 */

import type { ContextItem, ContextState } from '@opencode-harness/shared';

/**
 * Configuration for context tracker
 */
export interface ContextTrackerConfig {
    maxTokens: number;
    compactionThreshold: number;
    importanceDecayRate: number;
}

const DEFAULT_CONFIG: ContextTrackerConfig = {
    maxTokens: 100000,
    compactionThreshold: 0.8,
    importanceDecayRate: 0.95,
};

/**
 * Context Tracker - RLM-inspired state machine
 * 
 * Tracks what files, functions, and search results the AI has viewed.
 * Calculates importance scores and signals when compaction is needed.
 */
/**
 * Context Tracker - RLM-inspired state machine
 * 
 * Tracks what files, functions, and search results the AI has viewed.
 * Calculates importance scores and signals when compaction is needed.
 */
export function createContextTracker(initialConfig: Partial<ContextTrackerConfig> = {}) {
    const config = { ...DEFAULT_CONFIG, ...initialConfig };
    let state: ContextState = {
        items: [],
        totalTokensEstimate: 0,
        needsCompaction: false,
    };

    /**
     * Record that a file was viewed
     */
    function trackFile(path: string, tokens: number, summary?: string): void {
        addItem({
            path,
            type: 'file',
            viewedAt: Date.now(),
            importance: calculateImportance('file'),
            summary,
        }, tokens);
    }

    /**
     * Record that a function/class was viewed
     */
    function trackSymbol(path: string, symbolName: string, tokens: number): void {
        addItem({
            path: `${path}#${symbolName}`,
            type: 'function',
            viewedAt: Date.now(),
            importance: calculateImportance('function'),
        }, tokens);
    }

    /**
     * Record a search query
     */
    function trackSearch(query: string, resultCount: number): void {
        addItem({
            path: `search:${query}`,
            type: 'search',
            viewedAt: Date.now(),
            importance: calculateImportance('search'),
            summary: `${resultCount} results`,
        }, 100);
    }

    /**
     * Record a command execution
     */
    function trackCommand(command: string, outputTokens: number): void {
        addItem({
            path: `cmd:${command.substring(0, 50)}`,
            type: 'command',
            viewedAt: Date.now(),
            importance: calculateImportance('command'),
        }, outputTokens);
    }

    /**
     * Get current context state
     */
    function getState(): ContextState {
        return { ...state };
    }

    /**
     * Get items sorted by importance
     */
    function getByImportance(): ContextItem[] {
        return [...state.items].sort((a, b) => b.importance - a.importance);
    }

    /**
     * Get recently viewed items
     */
    function getRecent(limit: number = 10): ContextItem[] {
        return [...state.items]
            .sort((a, b) => b.viewedAt - a.viewedAt)
            .slice(0, limit);
    }

    /**
     * Check if we've seen a specific path
     */
    function hasSeen(path: string): boolean {
        return state.items.some((item) => item.path === path);
    }

    /**
     * Mark compaction as complete
     */
    function markCompacted(): void {
        state = {
            ...state,
            needsCompaction: false,
            lastCompactionAt: Date.now(),
        };
    }

    /**
     * Apply importance decay to all items
     * Call this periodically to reduce importance of old items
     */
    function applyDecay(): void {
        state = {
            ...state,
            items: state.items.map((item) => ({
                ...item,
                importance: item.importance * config.importanceDecayRate,
            })),
        };
    }

    /**
     * Remove low-importance items to free up context
     */
    function prune(importanceThreshold: number = 0.1): ContextItem[] {
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
            ),
        };

        checkCompactionNeeded();
        return removed;
    }

    /**
     * Format context for RLM-style navigation prompt
     */
    function formatForPrompt(): string {
        const items = getByImportance().slice(0, 20);

        const lines = [
            '## Context Navigator',
            '',
            '**Recently Viewed:**',
            ...getRecent(5).map(
                (item) => `- ${item.type}: ${item.path}`
            ),
            '',
            '**High Importance:**',
            ...items.slice(0, 5).map(
                (item) => `- [${(item.importance * 100).toFixed(0)}%] ${item.path}`
            ),
        ];

        if (state.needsCompaction) {
            lines.push('', '⚠️ **Context approaching limit - consider compacting**');
        }

        return lines.join('\n');
    }

    // Private methods

    function addItem(item: ContextItem, tokens: number): void {
        // Check if item already exists
        const existingIndex = state.items.findIndex(
            (i) => i.path === item.path
        );

        if (existingIndex >= 0) {
            // Update existing item
            const existing = state.items[existingIndex];
            state.items[existingIndex] = {
                ...existing,
                viewedAt: item.viewedAt,
                importance: Math.min(1, existing.importance + 0.1),
                summary: item.summary || existing.summary,
            };
        } else {
            // Add new item
            state.items.push(item);
            state.totalTokensEstimate += tokens;
        }

        checkCompactionNeeded();
    }

    function calculateImportance(type: ContextItem['type']): number {
        // Base importance by type
        const baseImportance: Record<ContextItem['type'], number> = {
            file: 0.7,
            function: 0.8,
            class: 0.8,
            search: 0.5,
            command: 0.6,
        };

        return baseImportance[type] ?? 0.5;
    }

    function estimateTokens(item: ContextItem): number {
        // Rough estimation based on type
        const tokenEstimates: Record<ContextItem['type'], number> = {
            file: 500,
            function: 200,
            class: 400,
            search: 100,
            command: 150,
        };

        return tokenEstimates[item.type] ?? 100;
    }

    function checkCompactionNeeded(): void {
        const ratio = state.totalTokensEstimate / config.maxTokens;
        state.needsCompaction = ratio >= config.compactionThreshold;
    }

    function reset(): void {
        state = {
            items: [],
            totalTokensEstimate: 0,
            needsCompaction: false,
        };
    }

    function getImportant(): ContextItem[] {
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

export type ContextTracker = ReturnType<typeof createContextTracker>;
