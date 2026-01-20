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
export class ContextTracker {
    private state: ContextState;
    private config: ContextTrackerConfig;

    constructor(config: Partial<ContextTrackerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.state = {
            items: [],
            totalTokensEstimate: 0,
            needsCompaction: false,
        };
    }

    /**
     * Record that a file was viewed
     */
    trackFile(path: string, tokens: number, summary?: string): void {
        this.addItem({
            path,
            type: 'file',
            viewedAt: Date.now(),
            importance: this.calculateImportance('file'),
            summary,
        }, tokens);
    }

    /**
     * Record that a function/class was viewed
     */
    trackSymbol(path: string, symbolName: string, tokens: number): void {
        this.addItem({
            path: `${path}#${symbolName}`,
            type: 'function',
            viewedAt: Date.now(),
            importance: this.calculateImportance('function'),
        }, tokens);
    }

    /**
     * Record a search query
     */
    trackSearch(query: string, resultCount: number): void {
        this.addItem({
            path: `search:${query}`,
            type: 'search',
            viewedAt: Date.now(),
            importance: this.calculateImportance('search'),
            summary: `${resultCount} results`,
        }, 100);
    }

    /**
     * Record a command execution
     */
    trackCommand(command: string, outputTokens: number): void {
        this.addItem({
            path: `cmd:${command.substring(0, 50)}`,
            type: 'command',
            viewedAt: Date.now(),
            importance: this.calculateImportance('command'),
        }, outputTokens);
    }

    /**
     * Get current context state
     */
    getState(): ContextState {
        return { ...this.state };
    }

    /**
     * Get items sorted by importance
     */
    getByImportance(): ContextItem[] {
        return [...this.state.items].sort((a, b) => b.importance - a.importance);
    }

    /**
     * Get recently viewed items
     */
    getRecent(limit: number = 10): ContextItem[] {
        return [...this.state.items]
            .sort((a, b) => b.viewedAt - a.viewedAt)
            .slice(0, limit);
    }

    /**
     * Check if we've seen a specific path
     */
    hasSeen(path: string): boolean {
        return this.state.items.some((item) => item.path === path);
    }

    /**
     * Mark compaction as complete
     */
    markCompacted(): void {
        this.state = {
            ...this.state,
            needsCompaction: false,
            lastCompactionAt: Date.now(),
        };
    }

    /**
     * Apply importance decay to all items
     * Call this periodically to reduce importance of old items
     */
    applyDecay(): void {
        this.state = {
            ...this.state,
            items: this.state.items.map((item) => ({
                ...item,
                importance: item.importance * this.config.importanceDecayRate,
            })),
        };
    }

    /**
     * Remove low-importance items to free up context
     */
    prune(importanceThreshold: number = 0.1): ContextItem[] {
        const removed = this.state.items.filter(
            (item) => item.importance < importanceThreshold
        );

        this.state = {
            ...this.state,
            items: this.state.items.filter(
                (item) => item.importance >= importanceThreshold
            ),
            totalTokensEstimate: this.state.items.reduce(
                (sum, item) => sum + this.estimateTokens(item),
                0
            ),
        };

        this.checkCompactionNeeded();
        return removed;
    }

    /**
     * Format context for RLM-style navigation prompt
     */
    formatForPrompt(): string {
        const items = this.getByImportance().slice(0, 20);

        const lines = [
            '## Context Navigator',
            '',
            '**Recently Viewed:**',
            ...this.getRecent(5).map(
                (item) => `- ${item.type}: ${item.path}`
            ),
            '',
            '**High Importance:**',
            ...items.slice(0, 5).map(
                (item) => `- [${(item.importance * 100).toFixed(0)}%] ${item.path}`
            ),
        ];

        if (this.state.needsCompaction) {
            lines.push('', '⚠️ **Context approaching limit - consider compacting**');
        }

        return lines.join('\n');
    }

    // Private methods

    private addItem(item: ContextItem, tokens: number): void {
        // Check if item already exists
        const existingIndex = this.state.items.findIndex(
            (i) => i.path === item.path
        );

        if (existingIndex >= 0) {
            // Update existing item
            const existing = this.state.items[existingIndex];
            this.state.items[existingIndex] = {
                ...existing,
                viewedAt: item.viewedAt,
                importance: Math.min(1, existing.importance + 0.1),
                summary: item.summary || existing.summary,
            };
        } else {
            // Add new item
            this.state.items.push(item);
            this.state.totalTokensEstimate += tokens;
        }

        this.checkCompactionNeeded();
    }

    private calculateImportance(type: ContextItem['type']): number {
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

    private estimateTokens(item: ContextItem): number {
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

    private checkCompactionNeeded(): void {
        const ratio = this.state.totalTokensEstimate / this.config.maxTokens;
        this.state.needsCompaction = ratio >= this.config.compactionThreshold;
    }
}
