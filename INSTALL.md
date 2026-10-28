# Installing dw-system

**English** | [中文](./INSTALL_zh.md) · Back to [README](./README.md)

This page covers what the installer changes on your machine and in your project. For the install commands and common flags, see [README › Install Options](./README.md#install-options); for every flag, run `npx --yes git+https://github.com/weidwonder/dw-system.git --help`.

**Prerequisites**: Node.js 20+, npm, and Git. Claude Code, Codex, or both.

---

## Per-project install

Run at the target project root:

```bash
npx --yes git+https://github.com/weidwonder/dw-system.git .
```

The installer prints its plan and asks once before changing anything (`--yes` skips the question). Then, in order:

1. **Fetch and verify the source.** It downloads the `--ref` version of the `--repo` repository from GitHub and checks that it contains at least one valid skill. If the download or the check fails, the target project is left untouched and the installer exits non-zero.
2. **Copy the skills.** All skills of that version — the eight `dw-*` skills, with the `ctx` CLI inside `dw-code-facts` and the prototype tool inside `dw-prd` — go to `<project>/.claude/skills/` (Claude Code) and `<project>/.agents/skills/` (Codex), together with a version stamp. When upgrading an install older than 3.0, it first removes the old-named skill directories and version stamp, and rewrites the old marker blocks under the new names, keeping the fields you configured verbatim. When upgrading across versions that need manual steps, it prints their migration guides.
3. **Update `.gitignore`.** It appends an idempotent marker block that ignores the installed skill directories, the version stamp, and the local codegraph index `.codegraph/`. It also asks once whether `docs/` and `engineering-context/` should be committed to git:
   - The default (just press Enter) is **no**: both directories are added to the same block.
   - **Yes** leaves both directories completely untouched.
   - The answer is recorded as a comment line inside the block, so re-installs reuse it and never ask again.
   - `--yes` and non-interactive terminals (CI, unattended npx) settle on the same default `no`.
   - If your `.gitignore` already ignores those directories itself, the installer neither asks nor takes those rules over.
   - `--docs-in-git=yes|no` overrides all of the above, and is how you change your mind later.
4. **Switch off conflicting Claude Code plugins for this project only.** It merges `false` entries into `enabledPlugins` without overwriting other keys. By default it writes `.claude/settings.local.json` (git-ignored, affects only you); with `--shared` it writes `.claude/settings.json` (committed, affects everyone who clones the repo). See [Conflicting plugins](#conflicting-plugins).
5. **Handle the conflicting Codex skill.** By default it writes a `dw-system:codex-conflicts` block into the project's `AGENTS.md` that stops it from auto-triggering in this project. An interactive install can choose a global uninstall through the Codex CLI instead; `--codex-conflicts=uninstall` does the same for automation.
6. **Sync the entry files.** If either `CLAUDE.md` or `AGENTS.md` already has a `dw-workflow` marker block, both entry files are reconciled to it (`CLAUDE.md` wins). An idempotent hint block ("load `dw-workflow` before you start") is written at the very top of entry files that **already existed**; an entry file created by this step only gets the marker block.
7. **Install the companion skills.** `agentic-principle` and `skill-principle` go to the user-level `~/.claude/skills/` and `~/.codex/skills/`, shared by all projects. Every run compares against the remote version and updates only when the local copy is older. A local copy that is a symlink or a git working tree is only reported, never overwritten. Fetch failures degrade to a warning. Skip with `--no-companions`; point one companion at another repository with `--companion-repo=<name>=<url>`.
8. **Link `ctx` as a global command.** It runs `npm link` inside `<project>/.claude/skills/dw-code-facts/scripts/ctx` and verifies the result by actually running `ctx --help`. If linking fails — no write permission, npm's global bin not on PATH, or somebody else's `ctx` already on PATH — it degrades to a warning and prints the fallback `node <skill>/scripts/ctx/src/cli.js <command>`. Somebody else's `ctx` is never overwritten. On Windows, re-installing from a different project makes `npm link` fail with `EEXIST` because the previous install's `ctx` is still in the global command directory; the installer checks whether that file is ours and, if so, replaces it with `npm link --force`; if ownership cannot be established it touches nothing and prints the file path plus how to remove it. Skip with `--no-ctx-link`.
9. **Keep [codegraph](https://github.com/colbymchenry/codegraph) up to date and index the project.** It runs `npm install -g @colbymchenry/codegraph` when codegraph is missing and `codegraph upgrade` when it is outdated, then wires it into your agents (this project only by default; `--codegraph-location=global` for every project) and builds the index with `codegraph init` unless `.codegraph/` already exists. Codex has no project-local MCP config, so project-level wiring skips Codex and prints the manual global command. Every failure here degrades to a warning; skip the whole step with `--no-codegraph`.

Steps 7–9 run after the project files are written; their failures never undo the skill install.

---

## Global install

```bash
npx --yes git+https://github.com/weidwonder/dw-system.git --global
npx --yes git+https://github.com/weidwonder/dw-system.git --global --dry-run
```

Installs once into `~/.claude/skills/` (Claude Code) and `~/.codex/skills/` (Codex), shared by every project on this machine. No target directory is given and no project file is touched: the `CLAUDE.md` / `AGENTS.md` block is written later, the first time you invoke a skill inside a project.

- Conflicting plugins are **uninstalled from this machine** instead of being switched off per project: Claude Code user-scope installs only, Codex `superpowers`. `--keep=<short-name>` keeps one, `--no-plugins` skips the step; if `claude` / `codex` is not on PATH it prints the manual command.
- The global `ctx` command links to the user-level copy. codegraph is wired globally, but no index is built — run `codegraph init` in a project root for that.
- Project-only flags are rejected: a target directory, `--shared`, `--docs-in-git`, `--codex-conflicts`, `--codegraph-location=local`.
- Copies already installed inside projects stay where they are. When both exist, which one Claude Code / Codex loads is up to the tool, so keep just one.

Use `--global` rather than copying skill directories by hand: a plain copy writes no version stamp, so later upgrades cannot show their migration guides, and it skips conflict handling and the `ctx` link.

---

## Install from a local clone

For maintaining this repo or troubleshooting:

```bash
# With this repo already cloned:
node /path/to/dw-system/install.mjs .

# Windows wrapper:
#   \path\to\dw-system\install.cmd .

# Only for developing/testing unpublished changes of this repo:
node /path/to/dw-system/install.mjs . --source-dir=/path/to/dw-system
```

---

## Conflicting plugins

| Plugin | Why it conflicts with this pipeline |
|---|---|
| Claude Code `superpowers` | brainstorming HARD-GATE + `using-superpowers` forced preamble hijacks Triage / direct implementation |
| Claude Code `everything-claude-code` | plan/tdd/coding-standards overlap + SessionStart hook injection |
| Claude Code `oh-my-claudecode` | autopilot/ralph/ultrawork end-to-end engines replace this pipeline + agents-overlay hook |
| Claude Code `general-task` | SessionStart injects clarify→plan→execute + `using-general-task` forced preamble (`--keep=general-task` to retain) |
| Codex `superpowers@openai-api-curated` | by default an `AGENTS.md` auto-trigger constraint in this project; an explicit choice can uninstall it globally through the Codex CLI |

**Why switching off per project works**: Claude Code settings precedence is Managed > Local (`.claude/settings.local.json`) > Project (`.claude/settings.json`) > User (`~/.claude/settings.json`), and `enabledPlugins` is honored at every scope. A project-level `false` overrides a user-level `true`, so these plugins are off **in this project only**. The Codex default works the same way: a constraint in the project's `AGENTS.md` instead of editing `~/.codex/config.toml`. A global uninstall requires the Codex CLI and affects all projects for the current user.

---

## After installing

- **Restart** Claude Code / Codex: settings and `AGENTS.md` changes take effect in the next session, not the current one. If Claude Code shows a **workspace trust** dialog when you open the project, the project settings apply once you trust it.
- **First invocation** of a skill in the project runs a one-time setup. It asks one question — is anyone else developing this project with you — and, in the same batch, proposes whether finished work merges locally or goes through a PR for you to confirm; the answers are written into `CLAUDE.md` and `AGENTS.md`. It never asks whether to maintain the code-fact layer (that is mandatory and scaffolded inside the task worktree), and never asks whether the project has a code-graph index (that is detected on every run).
- **Codex users**: project-level skills live under `<project>/.agents/skills/`; the user-level location is `~/.codex/skills/` (Codex has no user-level `~/.agents/` directory — don't install there). Codex reads `AGENTS.md`, which setup writes alongside `CLAUDE.md`. `ctx` is a plain shell command, so it works the same in both tools.
- **Document directories**: specs go to `docs/spec/`, plans to `docs/plan/`, reports to `docs/report/` — no tool-named directories, no deliverables scattered at the project root.

---

## Undo the plugin changes

- **Claude Code plugins**: delete the `false` entries the installer added under `enabledPlugins` in `.claude/settings.local.json` (or `.claude/settings.json` with `--shared`).
- **Codex constraint**: remove the `dw-system:codex-conflicts` block from `AGENTS.md`.
