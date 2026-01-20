/**
 * CLI Command: init
 * Initialize harness in current project
 */

import { mkdir, writeFile, copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import { DEFAULT_CONFIG, type HarnessConfig } from '@opencode-harness/shared';

interface InitOptions {
    force?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
    const spinner = ora('Initializing OpenCode Harness...').start();
    const cwd = process.cwd();

    try {
        // Check if already initialized
        const harnessDir = join(cwd, '.opencode', '.harness');
        const configPath = join(harnessDir, 'config.json');

        if (existsSync(configPath) && !options.force) {
            spinner.warn('Harness already initialized. Use --force to reinitialize.');
            return;
        }

        // Create directories
        spinner.text = 'Creating directories...';
        await mkdir(harnessDir, { recursive: true });
        await mkdir(join(cwd, '.opencode', 'agents'), { recursive: true });
        await mkdir(join(cwd, '.opencode', 'commands'), { recursive: true });
        await mkdir(join(cwd, '.opencode', 'plugins'), { recursive: true });

        // Write default config
        spinner.text = 'Writing configuration...';
        const config: HarnessConfig = { ...DEFAULT_CONFIG };
        await writeFile(configPath, JSON.stringify(config, null, 2));

        // Create opencode.json if it doesn't exist
        const opencodeConfigPath = join(cwd, 'opencode.json');
        if (!existsSync(opencodeConfigPath)) {
            spinner.text = 'Creating opencode.json...';

            // Resolve path to plugin package
            let pluginPath = '@opencode-harness/plugin';

            try {
                // Get the directory of the current module (ESM compatible)
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = dirname(__filename);

                // Windows path handling
                const normalizedPath = __dirname.replace(/\\/g, '/');

                if (normalizedPath.includes('packages/cli')) {
                    // We are likely in the source/monorepo structure
                    const rootDir = normalizedPath.split('packages/cli')[0];
                    const localPluginPath = join(rootDir, 'packages', 'plugin').replace(/\\/g, '/');
                    if (existsSync(localPluginPath)) {
                        pluginPath = `file://${localPluginPath}`;
                    }
                }
            } catch (e) {
                // Fallback to npm package name if resolution fails
            }

            const opencodeConfig = {
                $schema: 'https://opencode.ai/config.json',
                plugin: [pluginPath],
                compaction: {
                    auto: true,
                    prune: true,
                },
                instructions: ['AGENTS.md'],
            };
            await writeFile(opencodeConfigPath, JSON.stringify(opencodeConfig, null, 2));
        }

        // Create orchestrator agent
        const orchestratorAgent = `---
description: Primary orchestrator agent with harness awareness
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

You are the Orchestrator agent, enhanced with OpenCode Harness capabilities.

## Harness Integration

You have access to the \`context-nav\` tool for RLM-style context management:
- Use \`context-nav status\` to check your context state
- Use \`context-nav seen <path>\` before reading files to avoid redundant reads
- Use \`context-nav memory\` to recall past session learnings
- Use \`context-nav search <query>\` to find relevant memories

## Memory Persistence

Your decisions and findings are automatically saved. Before starting a new task:
1. Check for relevant memories from past sessions
2. Avoid re-learning things you've already discovered
3. Build upon previous work

## Context Efficiency

Be mindful of context usage:
- Check if files were already read before reading again
- Use summaries instead of full file contents when possible
- Request compaction when context is getting full
`;
        await writeFile(join(cwd, '.opencode', 'agents', 'orchestrator.md'), orchestratorAgent);

        // Create harness command
        const harnessCommand = `---
description: Start autonomous harness mode
agent: build
---

# Autonomous Harness Mode

You are now in autonomous harness mode. Execute the following task until completion:

$ARGUMENTS

## Rules

1. **Complete the task fully** - Don't stop until the task is done or you hit an error
2. **Use context-nav** - Check what you've already seen before reading files
3. **Persist learnings** - Important decisions and findings will be saved
4. **Verify your work** - Run tests/lint after making changes
5. **Report progress** - Log what you're doing at each step

Begin the task now.
`;
        await writeFile(join(cwd, '.opencode', 'commands', 'harness.md'), harnessCommand);

        // Create compact command
        const compactCommand = `---
description: Compact context using RLM strategy
agent: build
---

# Context Compaction

Check current context state with \`context-nav status\`.

If compaction is needed:
1. Review high-importance items
2. Summarize recent work
3. Save key findings to memory
4. Request a fresh context start

Use \`context-nav important\` to see what should be preserved.
`;
        await writeFile(join(cwd, '.opencode', 'commands', 'compact.md'), compactCommand);

        spinner.succeed(chalk.green('OpenCode Harness initialized!'));

        console.log('');
        console.log(chalk.gray('Created:'));
        console.log(chalk.gray('  .opencode/.harness/config.json'));
        console.log(chalk.gray('  .opencode/agents/orchestrator.md'));
        console.log(chalk.gray('  .opencode/commands/harness.md'));
        console.log(chalk.gray('  .opencode/commands/compact.md'));
        console.log('');
        console.log(chalk.cyan('Next steps:'));
        console.log(chalk.white('  1. Run ') + chalk.yellow('oc-harness run "your task"') + chalk.white(' to execute a task'));
        console.log(chalk.white('  2. Or use ') + chalk.yellow('oc-harness prd tasks.md') + chalk.white(' for PRD-driven execution'));
    } catch (error) {
        spinner.fail(chalk.red('Failed to initialize harness'));
        console.error(error);
        process.exit(1);
    }
}
