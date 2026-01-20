# OpenCode Harness

<p align="center">
  <b>🚀 Autonomous AI Coding Harness for OpenCode</b>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#examples">Examples</a> •
  <a href="#commands">Commands</a> •
  <a href="#how-it-works">How It Works</a>
</p>

---

## Quick Start

**One command to get started:**

```bash
npx opencode-harness setup
```

This will:
1. ✅ Check if OpenCode is installed
2. ✅ Install OpenCode if missing
3. ✅ Initialize harness in your project
4. ✅ Create agents and commands

**That's it!** You're ready to use autonomous AI coding.

---

## What is OpenCode Harness?

OpenCode Harness turns [OpenCode](https://opencode.ai) into an **autonomous coding agent** that can:

- 🔄 **Run tasks in a loop** until completion
- 📋 **Execute PRD files** with multiple tasks
- 🧠 **Remember context** across sessions (RLM-style)
- ⚡ **Run tasks in parallel** with git worktrees

---

## Features

| Feature | Description |
|---------|-------------|
| **Auto-Setup** | One command installs everything |
| **Autonomous Loop** | Runs until task is complete or max iterations |
| **PRD Execution** | Parse Markdown or YAML task files |
| **Memory Persistence** | Remembers past sessions and decisions |
| **Context Tracking** | RLM-inspired context management |
| **Parallel Execution** | Run multiple tasks simultaneously |

---

## Examples

### Single Task

```bash
# Fix a bug
oc-harness run "fix the login button not working on mobile"

# Add a feature
oc-harness run "add dark mode toggle to the settings page"

# Refactor code
oc-harness run "refactor the auth module to use async/await"
```

### PRD-Driven

Create a `PRD.md` file:

```markdown
## Tasks

- [ ] Create user authentication system
- [ ] Add profile page with avatar upload
- [ ] Build dashboard with charts
- [ ] Write unit tests
```

Then run:

```bash
oc-harness prd PRD.md
```

### Parallel Execution

```bash
# Run 3 tasks in parallel
oc-harness prd tasks.md --parallel --max-parallel 3
```

### With Git Branches

```bash
# Create a branch for each task
oc-harness prd tasks.md --branch-per-task --base-branch main
```

---

## Commands

| Command | Description |
|---------|-------------|
| `oc-harness setup` | 🚀 **One-click setup** (installs OpenCode + initializes) |
| `oc-harness init` | Initialize harness in current project |
| `oc-harness run "task"` | Run a single task autonomously |
| `oc-harness prd [file]` | Execute tasks from PRD file |
| `oc-harness status` | Check harness status and memory |

### In-Session Commands

After running `opencode`, you can use these commands:

| Command | Description |
|---------|-------------|
| `/harness` | Start autonomous harness mode |
| `/compact` | Compact context using RLM strategy |

---

## How It Works

OpenCode Harness combines two components:

### 1. Plugin (Context Management)

- **RLM-style tracking**: Knows what files you've seen
- **Memory persistence**: Saves decisions and findings
- **Smart compaction**: Prevents context rot

### 2. CLI (Task Orchestration)

- **Autonomous loops**: Runs until completion
- **PRD parsing**: Markdown and YAML support
- **Parallel execution**: Multiple agents in parallel

```
┌─────────────────────────────────────────────┐
│              oc-harness CLI                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐   │
│  │ Run Cmd │ │ PRD Cmd │ │ Parallel    │   │
│  └────┬────┘ └────┬────┘ │ Executor    │   │
│       │           │      └──────┬──────┘   │
│       └───────────┴─────────────┘          │
│                    │                        │
│              ┌─────▼─────┐                  │
│              │  OpenCode │                  │
│              │ + Plugin  │                  │
│              └───────────┘                  │
└─────────────────────────────────────────────┘
```

---

## Configuration

After `oc-harness init`, you get:

```
your-project/
├── .opencode/
│   ├── .harness/
│   │   └── config.json    # Harness configuration
│   ├── agents/
│   │   └── orchestrator.md # Harness-aware agent
│   ├── commands/
│   │   ├── harness.md     # /harness command
│   │   └── compact.md     # /compact command
│   └── plugins/
└── opencode.json          # OpenCode config
```

---

## Requirements

- **Node.js** 20 or higher
- **OpenCode** (installed automatically by `setup`)

---

## Installation Options

### Option 1: npx (Recommended)

```bash
npx opencode-harness setup
```

### Option 2: Global Install

```bash
npm install -g opencode-harness
oc-harness setup
```

### Option 3: Manual

```bash
# Install OpenCode first
npm install -g opencode-ai

# Then install harness
npm install -g opencode-harness
oc-harness init
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

---

## License

MIT
