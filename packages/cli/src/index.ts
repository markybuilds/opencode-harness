#!/usr/bin/env node
/**
 * OpenCode Harness CLI
 * 
 * Autonomous AI coding harness for OpenCode.
 * Run tasks, PRDs, and manage context with RLM-style memory.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { prdCommand } from './commands/prd.js';
import { statusCommand } from './commands/status.js';
import { setupCommand } from './commands/setup.js';

const program = new Command();

// ASCII art banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('OpenCode Harness')} ${chalk.gray('- AI Coding Harness')}     ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════╝')}
`;

program
    .name('oc-harness')
    .description('Autonomous AI coding harness for OpenCode')
    .version('0.1.0')
    .addHelpText('before', banner);

// One-click setup (featured command)
program
    .command('setup')
    .description('🚀 One-click setup: installs OpenCode + initializes harness')
    .option('--skip-opencode', 'Skip OpenCode installation')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(setupCommand);

// Initialize harness in project
program
    .command('init')
    .description('Initialize harness in current project')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(initCommand);

// Run a single task
program
    .command('run [task]')
    .description('Run a single task autonomously')
    .option('-m, --max-iterations <n>', 'Maximum iterations', '10')
    .option('--no-tests', 'Skip running tests after task')
    .option('--no-lint', 'Skip running lint after task')
    .option('-v, --verbose', 'Verbose output')
    .action(runCommand);

// Run PRD-driven tasks
program
    .command('prd [file]')
    .description('Execute tasks from a PRD/task file')
    .option('-p, --parallel', 'Run tasks in parallel')
    .option('--max-parallel <n>', 'Max parallel agents', '3')
    .option('--branch-per-task', 'Create branch for each task')
    .option('--base-branch <name>', 'Base branch name', 'main')
    .option('-v, --verbose', 'Verbose output')
    .action(prdCommand);

// Check status
program
    .command('status')
    .description('Check harness status and running sessions')
    .action(statusCommand);

// Parse and run
program.parse();

