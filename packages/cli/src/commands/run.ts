/**
 * CLI Command: run
 * Run a single task autonomously
 */

import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { join } from 'path';

interface RunOptions {
    maxIterations?: string;
    tests?: boolean;
    lint?: boolean;
    verbose?: boolean;
}

export async function runCommand(
    task: string | undefined,
    options: RunOptions
): Promise<void> {
    const cwd = process.cwd();

    // Check if harness is initialized
    if (!existsSync(join(cwd, '.opencode', '.harness', 'config.json'))) {
        console.log(chalk.yellow('⚠️  Harness not initialized. Run ') + chalk.cyan('oc-harness init') + chalk.yellow(' first.'));
        return;
    }

    if (!task) {
        console.log(chalk.red('❌ No task provided. Usage: oc-harness run "your task"'));
        return;
    }

    const maxIterations = parseInt(options.maxIterations || '10', 10);
    const runTests = options.tests !== false;
    const runLint = options.lint !== false;
    const verbose = options.verbose || false;

    console.log('');
    console.log(chalk.cyan('╔═══════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.white('  OpenCode Harness - Task Runner           ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.gray('Task: ') + chalk.white(task));
    console.log(chalk.gray('Max Iterations: ') + chalk.white(maxIterations));
    console.log(chalk.gray('Run Tests: ') + chalk.white(runTests ? 'Yes' : 'No'));
    console.log(chalk.gray('Run Lint: ') + chalk.white(runLint ? 'Yes' : 'No'));
    console.log('');

    const spinner = ora('Starting OpenCode session...').start();

    let iteration = 0;
    let success = false;

    while (iteration < maxIterations && !success) {
        iteration++;
        spinner.text = `Iteration ${iteration}/${maxIterations}...`;

        try {
            // Build the prompt with harness context
            const prompt = buildPrompt(task, iteration, runTests, runLint);

            // Run OpenCode
            if (verbose) {
                spinner.stop();
                console.log(chalk.gray(`\n[Iteration ${iteration}] Running OpenCode...`));
            }

            const result = await execa('opencode', ['run', prompt], {
                cwd,
                env: { ...process.env, FORCE_COLOR: '1' },
                timeout: 300000, // 5 minute timeout per iteration
            });

            if (verbose) {
                console.log(chalk.gray(result.stdout));
            }

            // Check for success indicators
            if (result.stdout.includes('Task completed successfully') ||
                result.stdout.includes('All tests passed') ||
                result.stdout.includes('✓') && !result.stdout.includes('Error')) {
                success = true;
                spinner.succeed(chalk.green(`Task completed in ${iteration} iteration(s)!`));
            } else if (result.stdout.includes('Error') || result.stdout.includes('Failed')) {
                if (verbose) {
                    console.log(chalk.yellow(`[Iteration ${iteration}] Errors detected, retrying...`));
                }
            } else {
                // Assume success if no obvious errors
                success = true;
                spinner.succeed(chalk.green(`Task completed in ${iteration} iteration(s)!`));
            }

        } catch (error) {
            const err = error as Error & { stderr?: string };
            if (verbose) {
                console.log(chalk.red(`[Iteration ${iteration}] Error: ${err.message}`));
                if (err.stderr) {
                    console.log(chalk.gray(err.stderr));
                }
            }

            if (iteration >= maxIterations) {
                spinner.fail(chalk.red(`Task failed after ${maxIterations} iterations`));
                process.exit(1);
            }
        }
    }

    if (!success) {
        spinner.fail(chalk.red(`Task did not complete within ${maxIterations} iterations`));
        process.exit(1);
    }

    console.log('');
    console.log(chalk.gray('Memory has been saved for future sessions.'));
}

function buildPrompt(
    task: string,
    iteration: number,
    runTests: boolean,
    runLint: boolean
): string {
    const parts = [
        '# Harness Task',
        '',
        `**Task:** ${task}`,
        `**Iteration:** ${iteration}`,
        '',
        '## Instructions',
        '',
        '1. First, use `context-nav memory` to check for relevant past learnings',
        '2. Use `context-nav seen <path>` before reading files to avoid redundant reads',
        '3. Execute the task completely',
    ];

    if (runTests) {
        parts.push('4. Run tests after making changes');
    }

    if (runLint) {
        parts.push(`${runTests ? '5' : '4'}. Run lint to check for issues`);
    }

    parts.push(
        '',
        '## Completion',
        '',
        'When the task is complete, output: "Task completed successfully"',
        'If you encounter an unrecoverable error, output: "Task failed: <reason>"',
    );

    return parts.join('\n');
}
