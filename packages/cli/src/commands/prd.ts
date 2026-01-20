/**
 * CLI Command: prd
 * Execute tasks from a PRD/task file
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseYaml } from 'yaml';
import { execa } from 'execa';
import type { Task, TaskList, TaskStatus } from '@opencode-harness/shared';

interface PrdOptions {
    parallel?: boolean;
    maxParallel?: string;
    branchPerTask?: boolean;
    baseBranch?: string;
    verbose?: boolean;
}

export async function prdCommand(
    file: string | undefined,
    options: PrdOptions
): Promise<void> {
    const cwd = process.cwd();

    // Check if harness is initialized
    if (!existsSync(join(cwd, '.opencode', '.harness', 'config.json'))) {
        console.log(chalk.yellow('⚠️  Harness not initialized. Run ') + chalk.cyan('oc-harness init') + chalk.yellow(' first.'));
        return;
    }

    // Find PRD file
    const prdPath = file || findPrdFile(cwd);
    if (!prdPath) {
        console.log(chalk.red('❌ No PRD file found. Provide a file or create PRD.md/tasks.md'));
        return;
    }

    console.log('');
    console.log(chalk.cyan('╔═══════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.white('  OpenCode Harness - PRD Executor          ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════╝'));
    console.log('');

    const spinner = ora('Parsing PRD file...').start();

    try {
        // Parse the PRD file
        const content = await readFile(prdPath, 'utf-8');
        const taskList = parsePrdFile(prdPath, content);

        spinner.succeed(`Found ${taskList.tasks.length} tasks in ${prdPath}`);

        console.log('');
        console.log(chalk.gray('Tasks:'));
        for (const task of taskList.tasks) {
            const status = task.status === 'completed' ? chalk.green('✓') : chalk.gray('○');
            console.log(`  ${status} ${task.title}`);
        }
        console.log('');

        // Filter pending tasks
        const pendingTasks = taskList.tasks.filter((t) => t.status === 'pending');

        if (pendingTasks.length === 0) {
            console.log(chalk.green('✅ All tasks completed!'));
            return;
        }

        console.log(chalk.cyan(`Executing ${pendingTasks.length} pending tasks...`));
        console.log('');

        // Execute tasks
        if (options.parallel) {
            await executeParallel(pendingTasks, options, cwd);
        } else {
            await executeSequential(pendingTasks, options, cwd);
        }

        console.log('');
        console.log(chalk.green('✅ PRD execution complete!'));

    } catch (error) {
        spinner.fail(chalk.red('Failed to execute PRD'));
        console.error(error);
        process.exit(1);
    }
}

function findPrdFile(cwd: string): string | null {
    const candidates = ['PRD.md', 'prd.md', 'tasks.md', 'TASKS.md', 'tasks.yaml', 'tasks.yml'];

    for (const candidate of candidates) {
        const path = join(cwd, candidate);
        if (existsSync(path)) {
            return path;
        }
    }

    return null;
}

function parsePrdFile(path: string, content: string): TaskList {
    const isYaml = path.endsWith('.yaml') || path.endsWith('.yml');

    if (isYaml) {
        return parseYamlTasks(path, content);
    } else {
        return parseMarkdownTasks(path, content);
    }
}

function parseYamlTasks(path: string, content: string): TaskList {
    const data = parseYaml(content) as { tasks?: Array<{ title: string; completed?: boolean }> };

    const tasks: Task[] = (data.tasks || []).map((item, index) => ({
        id: `task-${index}`,
        title: item.title,
        status: item.completed ? 'completed' : 'pending' as TaskStatus,
        retries: 0,
        maxRetries: 3,
        createdAt: Date.now(),
    }));

    return { source: path, format: 'yaml', tasks };
}

function parseMarkdownTasks(path: string, content: string): TaskList {
    const lines = content.split('\n');
    const tasks: Task[] = [];
    let index = 0;

    for (const line of lines) {
        // Match checkbox patterns: - [ ] task or - [x] task
        const match = line.match(/^[\s]*[-*]\s*\[([ xX])\]\s*(.+)$/);
        if (match) {
            const completed = match[1].toLowerCase() === 'x';
            const title = match[2].trim();

            tasks.push({
                id: `task-${index}`,
                title,
                status: completed ? 'completed' : 'pending' as TaskStatus,
                retries: 0,
                maxRetries: 3,
                createdAt: Date.now(),
            });
            index++;
        }
    }

    return { source: path, format: 'markdown', tasks };
}

async function executeSequential(
    tasks: Task[],
    options: PrdOptions,
    cwd: string
): Promise<void> {
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const spinner = ora(`[${i + 1}/${tasks.length}] ${task.title}`).start();

        try {
            // Create branch if requested
            if (options.branchPerTask) {
                const branchName = `harness/${slugify(task.title)}`;
                await execa('git', ['checkout', '-b', branchName], { cwd });
            }

            // Run the task
            const prompt = `Complete this task: ${task.title}`;
            await execa('opencode', ['run', prompt], {
                cwd,
                timeout: 300000,
            });

            spinner.succeed(`[${i + 1}/${tasks.length}] ${task.title}`);

            // Merge back if using branch workflow
            if (options.branchPerTask) {
                const baseBranch = options.baseBranch || 'main';
                await execa('git', ['checkout', baseBranch], { cwd });
                await execa('git', ['merge', '--no-ff', `harness/${slugify(task.title)}`], { cwd });
            }

        } catch (error) {
            spinner.fail(`[${i + 1}/${tasks.length}] ${task.title} - Failed`);
            if (options.verbose) {
                console.error(error);
            }
        }
    }
}

async function executeParallel(
    tasks: Task[],
    options: PrdOptions,
    cwd: string
): Promise<void> {
    const maxParallel = parseInt(options.maxParallel || '3', 10);
    const results: Array<{ task: Task; success: boolean }> = [];

    // Group tasks by parallel_group or run all at once
    const chunks: Task[][] = [];
    for (let i = 0; i < tasks.length; i += maxParallel) {
        chunks.push(tasks.slice(i, i + maxParallel));
    }

    for (const chunk of chunks) {
        console.log(chalk.gray(`\nRunning ${chunk.length} tasks in parallel...`));

        const promises = chunk.map(async (task, index) => {
            try {
                const prompt = `Complete this task: ${task.title}`;
                await execa('opencode', ['run', prompt], {
                    cwd,
                    timeout: 300000,
                });
                console.log(chalk.green(`  ✓ ${task.title}`));
                return { task, success: true };
            } catch {
                console.log(chalk.red(`  ✗ ${task.title}`));
                return { task, success: false };
            }
        });

        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
    }

    // Summary
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log('');
    console.log(chalk.gray('Summary:'));
    console.log(chalk.green(`  ✓ ${succeeded} succeeded`));
    if (failed > 0) {
        console.log(chalk.red(`  ✗ ${failed} failed`));
    }
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
}
