#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import chalk6 from "chalk";

// src/commands/init.ts
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import chalk from "chalk";
import ora from "ora";
import { DEFAULT_CONFIG } from "@opencode-harness/shared";
async function initCommand(options) {
  const spinner = ora("Initializing OpenCode Harness...").start();
  const cwd = process.cwd();
  try {
    const harnessDir = join(cwd, ".opencode", ".harness");
    const configPath = join(harnessDir, "config.json");
    if (existsSync(configPath) && !options.force) {
      spinner.warn("Harness already initialized. Use --force to reinitialize.");
      return;
    }
    spinner.text = "Creating directories...";
    await mkdir(harnessDir, { recursive: true });
    await mkdir(join(cwd, ".opencode", "agents"), { recursive: true });
    await mkdir(join(cwd, ".opencode", "commands"), { recursive: true });
    await mkdir(join(cwd, ".opencode", "plugins"), { recursive: true });
    spinner.text = "Writing configuration...";
    const config = { ...DEFAULT_CONFIG };
    await writeFile(configPath, JSON.stringify(config, null, 2));
    const opencodeConfigPath = join(cwd, "opencode.json");
    if (!existsSync(opencodeConfigPath)) {
      spinner.text = "Creating opencode.json...";
      let pluginPath = "@opencode-harness/plugin";
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const normalizedPath = __dirname.replace(/\\/g, "/");
        if (normalizedPath.includes("packages/cli")) {
          const rootDir = normalizedPath.split("packages/cli")[0];
          const localPluginPath = join(rootDir, "packages", "plugin").replace(/\\/g, "/");
          if (existsSync(localPluginPath)) {
            pluginPath = `file://${localPluginPath}`;
          }
        }
      } catch (e) {
      }
      const opencodeConfig = {
        $schema: "https://opencode.ai/config.json",
        plugin: [pluginPath],
        compaction: {
          auto: true,
          prune: true
        },
        instructions: ["AGENTS.md"]
      };
      await writeFile(opencodeConfigPath, JSON.stringify(opencodeConfig, null, 2));
    }
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
    await writeFile(join(cwd, ".opencode", "agents", "orchestrator.md"), orchestratorAgent);
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
    await writeFile(join(cwd, ".opencode", "commands", "harness.md"), harnessCommand);
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
    await writeFile(join(cwd, ".opencode", "commands", "compact.md"), compactCommand);
    spinner.succeed(chalk.green("OpenCode Harness initialized!"));
    console.log("");
    console.log(chalk.gray("Created:"));
    console.log(chalk.gray("  .opencode/.harness/config.json"));
    console.log(chalk.gray("  .opencode/agents/orchestrator.md"));
    console.log(chalk.gray("  .opencode/commands/harness.md"));
    console.log(chalk.gray("  .opencode/commands/compact.md"));
    console.log("");
    console.log(chalk.cyan("Next steps:"));
    console.log(chalk.white("  1. Run ") + chalk.yellow('oc-harness run "your task"') + chalk.white(" to execute a task"));
    console.log(chalk.white("  2. Or use ") + chalk.yellow("oc-harness prd tasks.md") + chalk.white(" for PRD-driven execution"));
  } catch (error) {
    spinner.fail(chalk.red("Failed to initialize harness"));
    console.error(error);
    process.exit(1);
  }
}

// src/commands/run.ts
import { execa } from "execa";
import chalk2 from "chalk";
import ora2 from "ora";
import { existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";
async function runCommand(task, options) {
  const cwd = process.cwd();
  if (!existsSync2(join2(cwd, ".opencode", ".harness", "config.json"))) {
    console.log(chalk2.yellow("\u26A0\uFE0F  Harness not initialized. Run ") + chalk2.cyan("oc-harness init") + chalk2.yellow(" first."));
    return;
  }
  if (!task) {
    console.log(chalk2.red('\u274C No task provided. Usage: oc-harness run "your task"'));
    return;
  }
  const maxIterations = parseInt(options.maxIterations || "10", 10);
  const runTests = options.tests !== false;
  const runLint = options.lint !== false;
  const verbose = options.verbose || false;
  console.log("");
  console.log(chalk2.cyan("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"));
  console.log(chalk2.cyan("\u2551") + chalk2.bold.white("  OpenCode Harness - Task Runner           ") + chalk2.cyan("\u2551"));
  console.log(chalk2.cyan("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"));
  console.log("");
  console.log(chalk2.gray("Task: ") + chalk2.white(task));
  console.log(chalk2.gray("Max Iterations: ") + chalk2.white(maxIterations));
  console.log(chalk2.gray("Run Tests: ") + chalk2.white(runTests ? "Yes" : "No"));
  console.log(chalk2.gray("Run Lint: ") + chalk2.white(runLint ? "Yes" : "No"));
  console.log("");
  const spinner = ora2("Starting OpenCode session...").start();
  let iteration = 0;
  let success = false;
  while (iteration < maxIterations && !success) {
    iteration++;
    spinner.text = `Iteration ${iteration}/${maxIterations}...`;
    try {
      const prompt = buildPrompt(task, iteration, runTests, runLint);
      if (verbose) {
        spinner.stop();
        console.log(chalk2.gray(`
[Iteration ${iteration}] Running OpenCode...`));
      }
      const result = await execa("opencode", ["run", prompt], {
        cwd,
        env: { ...process.env, FORCE_COLOR: "1" },
        timeout: 3e5
        // 5 minute timeout per iteration
      });
      if (verbose) {
        console.log(chalk2.gray(result.stdout));
      }
      if (result.stdout.includes("Task completed successfully") || result.stdout.includes("All tests passed") || result.stdout.includes("\u2713") && !result.stdout.includes("Error")) {
        success = true;
        spinner.succeed(chalk2.green(`Task completed in ${iteration} iteration(s)!`));
      } else if (result.stdout.includes("Error") || result.stdout.includes("Failed")) {
        if (verbose) {
          console.log(chalk2.yellow(`[Iteration ${iteration}] Errors detected, retrying...`));
        }
      } else {
        success = true;
        spinner.succeed(chalk2.green(`Task completed in ${iteration} iteration(s)!`));
      }
    } catch (error) {
      const err = error;
      if (verbose) {
        console.log(chalk2.red(`[Iteration ${iteration}] Error: ${err.message}`));
        if (err.stderr) {
          console.log(chalk2.gray(err.stderr));
        }
      }
      if (iteration >= maxIterations) {
        spinner.fail(chalk2.red(`Task failed after ${maxIterations} iterations`));
        process.exit(1);
      }
    }
  }
  if (!success) {
    spinner.fail(chalk2.red(`Task did not complete within ${maxIterations} iterations`));
    process.exit(1);
  }
  console.log("");
  console.log(chalk2.gray("Memory has been saved for future sessions."));
}
function buildPrompt(task, iteration, runTests, runLint) {
  const parts = [
    "# Harness Task",
    "",
    `**Task:** ${task}`,
    `**Iteration:** ${iteration}`,
    "",
    "## Instructions",
    "",
    "1. First, use `context-nav memory` to check for relevant past learnings",
    "2. Use `context-nav seen <path>` before reading files to avoid redundant reads",
    "3. Execute the task completely"
  ];
  if (runTests) {
    parts.push("4. Run tests after making changes");
  }
  if (runLint) {
    parts.push(`${runTests ? "5" : "4"}. Run lint to check for issues`);
  }
  parts.push(
    "",
    "## Completion",
    "",
    'When the task is complete, output: "Task completed successfully"',
    'If you encounter an unrecoverable error, output: "Task failed: <reason>"'
  );
  return parts.join("\n");
}

// src/commands/prd.ts
import { readFile } from "fs/promises";
import { existsSync as existsSync3 } from "fs";
import { join as join3 } from "path";
import chalk3 from "chalk";
import ora3 from "ora";
import { parse as parseYaml } from "yaml";
import { execa as execa2 } from "execa";
async function prdCommand(file, options) {
  const cwd = process.cwd();
  if (!existsSync3(join3(cwd, ".opencode", ".harness", "config.json"))) {
    console.log(chalk3.yellow("\u26A0\uFE0F  Harness not initialized. Run ") + chalk3.cyan("oc-harness init") + chalk3.yellow(" first."));
    return;
  }
  const prdPath = file || findPrdFile(cwd);
  if (!prdPath) {
    console.log(chalk3.red("\u274C No PRD file found. Provide a file or create PRD.md/tasks.md"));
    return;
  }
  console.log("");
  console.log(chalk3.cyan("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"));
  console.log(chalk3.cyan("\u2551") + chalk3.bold.white("  OpenCode Harness - PRD Executor          ") + chalk3.cyan("\u2551"));
  console.log(chalk3.cyan("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"));
  console.log("");
  const spinner = ora3("Parsing PRD file...").start();
  try {
    const content = await readFile(prdPath, "utf-8");
    const taskList = parsePrdFile(prdPath, content);
    spinner.succeed(`Found ${taskList.tasks.length} tasks in ${prdPath}`);
    console.log("");
    console.log(chalk3.gray("Tasks:"));
    for (const task of taskList.tasks) {
      const status = task.status === "completed" ? chalk3.green("\u2713") : chalk3.gray("\u25CB");
      console.log(`  ${status} ${task.title}`);
    }
    console.log("");
    const pendingTasks = taskList.tasks.filter((t) => t.status === "pending");
    if (pendingTasks.length === 0) {
      console.log(chalk3.green("\u2705 All tasks completed!"));
      return;
    }
    console.log(chalk3.cyan(`Executing ${pendingTasks.length} pending tasks...`));
    console.log("");
    if (options.parallel) {
      await executeParallel(pendingTasks, options, cwd);
    } else {
      await executeSequential(pendingTasks, options, cwd);
    }
    console.log("");
    console.log(chalk3.green("\u2705 PRD execution complete!"));
  } catch (error) {
    spinner.fail(chalk3.red("Failed to execute PRD"));
    console.error(error);
    process.exit(1);
  }
}
function findPrdFile(cwd) {
  const candidates = ["PRD.md", "prd.md", "tasks.md", "TASKS.md", "tasks.yaml", "tasks.yml"];
  for (const candidate of candidates) {
    const path = join3(cwd, candidate);
    if (existsSync3(path)) {
      return path;
    }
  }
  return null;
}
function parsePrdFile(path, content) {
  const isYaml = path.endsWith(".yaml") || path.endsWith(".yml");
  if (isYaml) {
    return parseYamlTasks(path, content);
  } else {
    return parseMarkdownTasks(path, content);
  }
}
function parseYamlTasks(path, content) {
  const data = parseYaml(content);
  const tasks = (data.tasks || []).map((item, index) => ({
    id: `task-${index}`,
    title: item.title,
    status: item.completed ? "completed" : "pending",
    retries: 0,
    maxRetries: 3,
    createdAt: Date.now()
  }));
  return { source: path, format: "yaml", tasks };
}
function parseMarkdownTasks(path, content) {
  const lines = content.split("\n");
  const tasks = [];
  let index = 0;
  for (const line of lines) {
    const match = line.match(/^[\s]*[-*]\s*\[([ xX])\]\s*(.+)$/);
    if (match) {
      const completed = match[1].toLowerCase() === "x";
      const title = match[2].trim();
      tasks.push({
        id: `task-${index}`,
        title,
        status: completed ? "completed" : "pending",
        retries: 0,
        maxRetries: 3,
        createdAt: Date.now()
      });
      index++;
    }
  }
  return { source: path, format: "markdown", tasks };
}
async function executeSequential(tasks, options, cwd) {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const spinner = ora3(`[${i + 1}/${tasks.length}] ${task.title}`).start();
    try {
      if (options.branchPerTask) {
        const branchName = `harness/${slugify(task.title)}`;
        await execa2("git", ["checkout", "-b", branchName], { cwd });
      }
      const prompt = `Complete this task: ${task.title}`;
      await execa2("opencode", ["run", prompt], {
        cwd,
        timeout: 3e5
      });
      spinner.succeed(`[${i + 1}/${tasks.length}] ${task.title}`);
      if (options.branchPerTask) {
        const baseBranch = options.baseBranch || "main";
        await execa2("git", ["checkout", baseBranch], { cwd });
        await execa2("git", ["merge", "--no-ff", `harness/${slugify(task.title)}`], { cwd });
      }
    } catch (error) {
      spinner.fail(`[${i + 1}/${tasks.length}] ${task.title} - Failed`);
      if (options.verbose) {
        console.error(error);
      }
    }
  }
}
async function executeParallel(tasks, options, cwd) {
  const maxParallel = parseInt(options.maxParallel || "3", 10);
  const results = [];
  const chunks = [];
  for (let i = 0; i < tasks.length; i += maxParallel) {
    chunks.push(tasks.slice(i, i + maxParallel));
  }
  for (const chunk of chunks) {
    console.log(chalk3.gray(`
Running ${chunk.length} tasks in parallel...`));
    const promises = chunk.map(async (task, index) => {
      try {
        const prompt = `Complete this task: ${task.title}`;
        await execa2("opencode", ["run", prompt], {
          cwd,
          timeout: 3e5
        });
        console.log(chalk3.green(`  \u2713 ${task.title}`));
        return { task, success: true };
      } catch {
        console.log(chalk3.red(`  \u2717 ${task.title}`));
        return { task, success: false };
      }
    });
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log("");
  console.log(chalk3.gray("Summary:"));
  console.log(chalk3.green(`  \u2713 ${succeeded} succeeded`));
  if (failed > 0) {
    console.log(chalk3.red(`  \u2717 ${failed} failed`));
  }
}
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 50);
}

// src/commands/status.ts
import { readFile as readFile2 } from "fs/promises";
import { existsSync as existsSync4 } from "fs";
import { join as join4 } from "path";
import chalk4 from "chalk";
async function statusCommand() {
  const cwd = process.cwd();
  console.log("");
  console.log(chalk4.cyan("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"));
  console.log(chalk4.cyan("\u2551") + chalk4.bold.white("  OpenCode Harness - Status                ") + chalk4.cyan("\u2551"));
  console.log(chalk4.cyan("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"));
  console.log("");
  const harnessDir = join4(cwd, ".opencode", ".harness");
  const configPath = join4(harnessDir, "config.json");
  const memoryPath = join4(harnessDir, "memory.json");
  if (!existsSync4(configPath)) {
    console.log(chalk4.yellow("\u26A0\uFE0F  Harness not initialized in this project"));
    console.log(chalk4.gray("   Run ") + chalk4.cyan("oc-harness init") + chalk4.gray(" to initialize"));
    return;
  }
  console.log(chalk4.green("\u2713 Harness initialized"));
  console.log("");
  try {
    const configContent = await readFile2(configPath, "utf-8");
    const config = JSON.parse(configContent);
    console.log(chalk4.bold("Configuration:"));
    console.log(chalk4.gray("  Memory Enabled: ") + chalk4.white(config.memory.enabled ? "Yes" : "No"));
    console.log(chalk4.gray("  Memory Max Entries: ") + chalk4.white(config.memory.maxEntries));
    console.log(chalk4.gray("  Context Max Tokens: ") + chalk4.white(config.context.maxTokens.toLocaleString()));
    console.log(chalk4.gray("  Auto Compact: ") + chalk4.white(config.context.autoCompact ? "Yes" : "No"));
    console.log(chalk4.gray("  Max Parallel: ") + chalk4.white(config.parallel.maxAgents));
    console.log("");
  } catch {
    console.log(chalk4.yellow("\u26A0\uFE0F  Could not read config"));
  }
  if (existsSync4(memoryPath)) {
    try {
      const memoryContent = await readFile2(memoryPath, "utf-8");
      const memory = JSON.parse(memoryContent);
      const lastUpdated = new Date(memory.lastUpdated).toLocaleString();
      const entryCount = memory.entries.length;
      const byType = {};
      for (const entry of memory.entries) {
        byType[entry.type] = (byType[entry.type] || 0) + 1;
      }
      console.log(chalk4.bold("Memory:"));
      console.log(chalk4.gray("  Total Entries: ") + chalk4.white(entryCount));
      console.log(chalk4.gray("  Last Updated: ") + chalk4.white(lastUpdated));
      if (entryCount > 0) {
        console.log(chalk4.gray("  By Type:"));
        for (const [type, count] of Object.entries(byType)) {
          console.log(chalk4.gray(`    ${type}: `) + chalk4.white(count));
        }
      }
      console.log("");
      if (entryCount > 0) {
        console.log(chalk4.bold("Recent Memories:"));
        const recent = memory.entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
        for (const entry of recent) {
          const date = new Date(entry.timestamp).toLocaleDateString();
          const importance = `${(entry.importance * 100).toFixed(0)}%`;
          const preview = entry.content.substring(0, 60) + (entry.content.length > 60 ? "..." : "");
          console.log(chalk4.gray(`  [${entry.type}] `) + chalk4.white(preview));
        }
        console.log("");
      }
    } catch {
      console.log(chalk4.yellow("\u26A0\uFE0F  Could not read memory"));
    }
  } else {
    console.log(chalk4.gray("No memory file yet (will be created on first session)"));
    console.log("");
  }
  const agentsDir = join4(cwd, ".opencode", "agents");
  const commandsDir = join4(cwd, ".opencode", "commands");
  if (existsSync4(agentsDir)) {
    const agents = await listFiles(agentsDir);
    if (agents.length > 0) {
      console.log(chalk4.bold("Custom Agents:"));
      for (const agent of agents) {
        console.log(chalk4.gray("  ") + chalk4.white(agent.replace(".md", "")));
      }
      console.log("");
    }
  }
  if (existsSync4(commandsDir)) {
    const commands = await listFiles(commandsDir);
    if (commands.length > 0) {
      console.log(chalk4.bold("Custom Commands:"));
      for (const command of commands) {
        console.log(chalk4.gray("  /") + chalk4.white(command.replace(".md", "")));
      }
      console.log("");
    }
  }
}
async function listFiles(dir) {
  const { readdir } = await import("fs/promises");
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

// src/commands/setup.ts
import { execa as execa3 } from "execa";
import chalk5 from "chalk";
import ora4 from "ora";
async function setupCommand(options) {
  console.log("");
  console.log(chalk5.cyan("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"));
  console.log(chalk5.cyan("\u2551") + chalk5.bold.white("  OpenCode Harness - One-Click Setup       ") + chalk5.cyan("\u2551"));
  console.log(chalk5.cyan("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"));
  console.log("");
  const spinner = ora4("Checking for OpenCode installation...").start();
  let opencodeInstalled = false;
  try {
    await execa3("opencode", ["--version"]);
    opencodeInstalled = true;
    spinner.succeed("OpenCode is already installed");
  } catch {
    spinner.warn("OpenCode not found");
  }
  if (!opencodeInstalled && !options.skipOpencode) {
    const installSpinner = ora4("Installing OpenCode globally...").start();
    try {
      await execa3("npm", ["install", "-g", "opencode-ai"], {
        timeout: 12e4
        // 2 minute timeout
      });
      installSpinner.succeed("OpenCode installed successfully!");
      const verifySpinner = ora4("Verifying installation...").start();
      try {
        const result = await execa3("opencode", ["--version"]);
        verifySpinner.succeed(`OpenCode ${result.stdout.trim()} ready`);
      } catch {
        verifySpinner.warn("OpenCode installed but not in PATH. You may need to restart your terminal.");
      }
    } catch (error) {
      installSpinner.fail("Failed to install OpenCode");
      console.log("");
      console.log(chalk5.yellow("Please install OpenCode manually:"));
      console.log(chalk5.gray("  npm install -g opencode-ai"));
      console.log(chalk5.gray("  # or"));
      console.log(chalk5.gray("  curl -fsSL https://opencode.ai/install | bash"));
      console.log("");
      if (!options.force) {
        console.log(chalk5.gray("Run with --skip-opencode to skip OpenCode installation"));
        return;
      }
    }
  } else if (options.skipOpencode && !opencodeInstalled) {
    console.log(chalk5.yellow("\u26A0\uFE0F  Skipping OpenCode installation as requested"));
  }
  console.log("");
  await initCommand({ force: options.force });
  console.log("");
  console.log(chalk5.green("\u{1F389} Setup complete!"));
  console.log("");
  console.log(chalk5.bold("What to do next:"));
  console.log("");
  console.log(chalk5.gray("  1. Start OpenCode:"));
  console.log(chalk5.cyan("     opencode"));
  console.log("");
  console.log(chalk5.gray("  2. Run an autonomous task:"));
  console.log(chalk5.cyan('     oc-harness run "add a hello world function"'));
  console.log("");
  console.log(chalk5.gray("  3. Execute tasks from a PRD file:"));
  console.log(chalk5.cyan("     oc-harness prd PRD.md"));
  console.log("");
  console.log(chalk5.gray("  4. Use in-session commands:"));
  console.log(chalk5.cyan("     /harness") + chalk5.gray(" - Start autonomous mode"));
  console.log(chalk5.cyan("     /compact") + chalk5.gray(" - Compact context"));
  console.log("");
  console.log(chalk5.gray("Documentation: https://github.com/markybuilds/opencode-harness"));
}

// src/index.ts
var program = new Command();
var banner = `
${chalk6.cyan("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557")}
${chalk6.cyan("\u2551")}  ${chalk6.bold.white("OpenCode Harness")} ${chalk6.gray("- AI Coding Harness")}     ${chalk6.cyan("\u2551")}
${chalk6.cyan("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}
`;
program.name("oc-harness").description("Autonomous AI coding harness for OpenCode").version("0.1.0").addHelpText("before", banner);
program.command("setup").description("\u{1F680} One-click setup: installs OpenCode + initializes harness").option("--skip-opencode", "Skip OpenCode installation").option("-f, --force", "Overwrite existing configuration").action(setupCommand);
program.command("init").description("Initialize harness in current project").option("-f, --force", "Overwrite existing configuration").action(initCommand);
program.command("run [task]").description("Run a single task autonomously").option("-m, --max-iterations <n>", "Maximum iterations", "10").option("--no-tests", "Skip running tests after task").option("--no-lint", "Skip running lint after task").option("-v, --verbose", "Verbose output").action(runCommand);
program.command("prd [file]").description("Execute tasks from a PRD/task file").option("-p, --parallel", "Run tasks in parallel").option("--max-parallel <n>", "Max parallel agents", "3").option("--branch-per-task", "Create branch for each task").option("--base-branch <name>", "Base branch name", "main").option("-v, --verbose", "Verbose output").action(prdCommand);
program.command("status").description("Check harness status and running sessions").action(statusCommand);
program.parse();
