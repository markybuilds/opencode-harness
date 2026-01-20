/**
 * CLI Command: setup
 * One-command setup that installs OpenCode if needed and initializes harness
 */

import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { initCommand } from './init.js';

interface SetupOptions {
    skipOpencode?: boolean;
    force?: boolean;
}

export async function setupCommand(options: SetupOptions): Promise<void> {
    console.log('');
    console.log(chalk.cyan('╔═══════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.white('  OpenCode Harness - One-Click Setup       ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════╝'));
    console.log('');

    // Step 1: Check for OpenCode
    const spinner = ora('Checking for OpenCode installation...').start();

    let opencodeInstalled = false;

    try {
        await execa('opencode', ['--version']);
        opencodeInstalled = true;
        spinner.succeed('OpenCode is already installed');
    } catch {
        spinner.warn('OpenCode not found');
    }

    // Step 2: Install OpenCode if needed
    if (!opencodeInstalled && !options.skipOpencode) {
        const installSpinner = ora('Installing OpenCode globally...').start();

        try {
            await execa('npm', ['install', '-g', 'opencode-ai'], {
                timeout: 120000, // 2 minute timeout
            });
            installSpinner.succeed('OpenCode installed successfully!');

            // Verify installation
            const verifySpinner = ora('Verifying installation...').start();
            try {
                const result = await execa('opencode', ['--version']);
                verifySpinner.succeed(`OpenCode ${result.stdout.trim()} ready`);
            } catch {
                verifySpinner.warn('OpenCode installed but not in PATH. You may need to restart your terminal.');
            }
        } catch (error) {
            installSpinner.fail('Failed to install OpenCode');
            console.log('');
            console.log(chalk.yellow('Please install OpenCode manually:'));
            console.log(chalk.gray('  npm install -g opencode-ai'));
            console.log(chalk.gray('  # or'));
            console.log(chalk.gray('  curl -fsSL https://opencode.ai/install | bash'));
            console.log('');

            if (!options.force) {
                console.log(chalk.gray('Run with --skip-opencode to skip OpenCode installation'));
                return;
            }
        }
    } else if (options.skipOpencode && !opencodeInstalled) {
        console.log(chalk.yellow('⚠️  Skipping OpenCode installation as requested'));
    }

    console.log('');

    // Step 3: Initialize harness
    await initCommand({ force: options.force });

    // Step 4: Show next steps
    console.log('');
    console.log(chalk.green('🎉 Setup complete!'));
    console.log('');
    console.log(chalk.bold('What to do next:'));
    console.log('');
    console.log(chalk.gray('  1. Start OpenCode:'));
    console.log(chalk.cyan('     opencode'));
    console.log('');
    console.log(chalk.gray('  2. Run an autonomous task:'));
    console.log(chalk.cyan('     oc-harness run "add a hello world function"'));
    console.log('');
    console.log(chalk.gray('  3. Execute tasks from a PRD file:'));
    console.log(chalk.cyan('     oc-harness prd PRD.md'));
    console.log('');
    console.log(chalk.gray('  4. Use in-session commands:'));
    console.log(chalk.cyan('     /harness') + chalk.gray(' - Start autonomous mode'));
    console.log(chalk.cyan('     /compact') + chalk.gray(' - Compact context'));
    console.log('');
    console.log(chalk.gray('Documentation: https://github.com/your-username/opencode-harness'));
}
