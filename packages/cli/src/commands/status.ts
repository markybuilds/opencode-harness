/**
 * CLI Command: status
 * Check harness status and running sessions
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import type { HarnessConfig, MemoryStore } from '@opencode-harness/shared';

export async function statusCommand(): Promise<void> {
    const cwd = process.cwd();

    console.log('');
    console.log(chalk.cyan('╔═══════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.white('  OpenCode Harness - Status                ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════╝'));
    console.log('');

    // Check initialization
    const harnessDir = join(cwd, '.opencode', '.harness');
    const configPath = join(harnessDir, 'config.json');
    const memoryPath = join(harnessDir, 'memory.json');

    if (!existsSync(configPath)) {
        console.log(chalk.yellow('⚠️  Harness not initialized in this project'));
        console.log(chalk.gray('   Run ') + chalk.cyan('oc-harness init') + chalk.gray(' to initialize'));
        return;
    }

    console.log(chalk.green('✓ Harness initialized'));
    console.log('');

    // Load and display config
    try {
        const configContent = await readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent) as HarnessConfig;

        console.log(chalk.bold('Configuration:'));
        console.log(chalk.gray('  Memory Enabled: ') + chalk.white(config.memory.enabled ? 'Yes' : 'No'));
        console.log(chalk.gray('  Memory Max Entries: ') + chalk.white(config.memory.maxEntries));
        console.log(chalk.gray('  Context Max Tokens: ') + chalk.white(config.context.maxTokens.toLocaleString()));
        console.log(chalk.gray('  Auto Compact: ') + chalk.white(config.context.autoCompact ? 'Yes' : 'No'));
        console.log(chalk.gray('  Max Parallel: ') + chalk.white(config.parallel.maxAgents));
        console.log('');
    } catch {
        console.log(chalk.yellow('⚠️  Could not read config'));
    }

    // Load and display memory stats
    if (existsSync(memoryPath)) {
        try {
            const memoryContent = await readFile(memoryPath, 'utf-8');
            const memory = JSON.parse(memoryContent) as MemoryStore;

            const lastUpdated = new Date(memory.lastUpdated).toLocaleString();
            const entryCount = memory.entries.length;

            // Count by type
            const byType: Record<string, number> = {};
            for (const entry of memory.entries) {
                byType[entry.type] = (byType[entry.type] || 0) + 1;
            }

            console.log(chalk.bold('Memory:'));
            console.log(chalk.gray('  Total Entries: ') + chalk.white(entryCount));
            console.log(chalk.gray('  Last Updated: ') + chalk.white(lastUpdated));

            if (entryCount > 0) {
                console.log(chalk.gray('  By Type:'));
                for (const [type, count] of Object.entries(byType)) {
                    console.log(chalk.gray(`    ${type}: `) + chalk.white(count));
                }
            }
            console.log('');

            // Show recent memories
            if (entryCount > 0) {
                console.log(chalk.bold('Recent Memories:'));
                const recent = memory.entries
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 5);

                for (const entry of recent) {
                    const date = new Date(entry.timestamp).toLocaleDateString();
                    const importance = `${(entry.importance * 100).toFixed(0)}%`;
                    const preview = entry.content.substring(0, 60) + (entry.content.length > 60 ? '...' : '');
                    console.log(chalk.gray(`  [${entry.type}] `) + chalk.white(preview));
                }
                console.log('');
            }
        } catch {
            console.log(chalk.yellow('⚠️  Could not read memory'));
        }
    } else {
        console.log(chalk.gray('No memory file yet (will be created on first session)'));
        console.log('');
    }

    // Check for installed agents and commands
    const agentsDir = join(cwd, '.opencode', 'agents');
    const commandsDir = join(cwd, '.opencode', 'commands');

    if (existsSync(agentsDir)) {
        const agents = await listFiles(agentsDir);
        if (agents.length > 0) {
            console.log(chalk.bold('Custom Agents:'));
            for (const agent of agents) {
                console.log(chalk.gray('  ') + chalk.white(agent.replace('.md', '')));
            }
            console.log('');
        }
    }

    if (existsSync(commandsDir)) {
        const commands = await listFiles(commandsDir);
        if (commands.length > 0) {
            console.log(chalk.bold('Custom Commands:'));
            for (const command of commands) {
                console.log(chalk.gray('  /') + chalk.white(command.replace('.md', '')));
            }
            console.log('');
        }
    }
}

async function listFiles(dir: string): Promise<string[]> {
    const { readdir } = await import('fs/promises');
    try {
        const files = await readdir(dir);
        return files.filter((f) => f.endsWith('.md'));
    } catch {
        return [];
    }
}
