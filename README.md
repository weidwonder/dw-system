# ai-dev-system — Ship With AI, Reliably

**English** | [中文](./README_zh.md)

![Node ≥20](https://img.shields.io/badge/Node-%E2%89%A520-brightgreen) ![Zero runtime dependencies](https://img.shields.io/badge/dependencies-zero-blue) ![Claude Code · Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%C2%B7%20Codex-8A2BE2) ![Cross platform](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-lightgrey)

**The methodology layer your AI coding stack is missing.** Prompting harder doesn't make AI coding reliable — engineering does. ai-dev-system decomposes a raw requirement, layer by layer, into tasks so well-specified that **a zero-context AI agent can execute them dependably** — through Triage, top-level design, engineering specs, coding plans, coding, and tests.

This is not a whiteboard framework. It is distilled from an AI-assisted development system **proven in real production across 50–60 brownfield repositories under bi-weekly, high-velocity iteration**, condensed into two skills. They layer onto one shared core along **two dimensions that do not imply each other**:

- **Collaboration surface** (asked once, stored in config) — is anyone else developing this project with you. Decides whether to align with repo owners, hold review meetings, go through PRs, and who adjudicates backward-compatibility trade-offs.
- **Capability bits** (detected at every run, never asked, never stored) — what code-fact assets **the project itself currently has**. A code-graph index → the **graph bit** (answers *can I find it*: symbols, call chains, blast radius). A filled-in capability registry → the **curated bit** (answers *which one do I trust*: when the same capability has several implementations, which is authoritative). The two are orthogonal; all four combinations are valid.

**These two get mismatched constantly, which is why they must be separate**: a ten-thousand-file legacy system maintained by one person needs the curated bit but no review meetings; a three-person greenfield project needs alignment but not a full asset layer. Tie them to a single "project type" switch and you get half of them wrong.

**Why teams pick it:**

- 🎯 **One-command install** into any project — Claude Code and Codex at the same time. Exactly one question (is anyone else developing with you); assets are detected, so you never pick a "tier".
- 🧠 **Engineering Context as the moat** — capability registry, per-repo codebase cards, end-to-end scene blueprints, a frozen probe set as an anti-rot gate. Every fact cited (`path#anchor @confirmed-date`); **no cite = treated as hallucination**.
- 🪶 **Zero runtime dependencies** — pure Node.js standard library + markdown. No build step, no lockfile drift, nothing to babysit.
- 🔒 **Discipline built in, not bolted on** — mandatory git-worktree isolation for every change, auto-merge only after all gates pass, business-language-only user communication, RFC2119 spec writing with zero placeholders.
- ⚖️ **Right-sized process** — a 4-question Triage routes small changes to a one-page Lean Spec and real risk (AI behavior, security, cross-service, irreversibility, external commitments) to the full pipeline. No cargo-cult ceremony.

> Core belief: whether AI coding lands in production is decided not by the process itself (anyone can copy a process), but by **whether you can hand the AI a trustworthy layer of code facts**. The two capability bits exist precisely for that — and they have nothing to do with how many colleagues you have.

---

## What's Inside

```
.                               # repo root
├── package.json                # npx GitHub command entry
├── install.mjs                 # installer (fetches a pinned version from GitHub, cross-platform)
├── install.cmd                 # Windows wrapper
├── docs/
│   ├── spec/                  # PRD / requirements / overview / spec / design / contracts
│   ├── plan/                  # coding plans / implementation & migration plans
│   └── report/                # execution / verification / test / audit reports
└── ai-dev-system/
    └── skills/                 # two skills (shared by Claude Code + Codex)
        ├── ai-prd/             # PRD authoring: batched questioning + staged elicitation
        │   ├── SKILL.md        # entry: read collaboration surface → PRD type routing → 4 question batches
        │   ├── references/     # generation flow / business-language & writing discipline / quality gate
        │   │   └── collab/     # solo.md / team.md (one of the two, by collaboration surface)
        │   └── assets/         # templates: change-prd (primary) / lite-issue-prd / product-prd
        └── ai-dev-workflow/    # the main pipeline, starting from an existing PRD
            ├── SKILL.md        # entry: detect capability bits → read collaboration surface → load; first call → initialization
            ├── references/
            │   ├── core/       # shared kernel: process / worktree / communication / writing / AI overlay / doc governance
            │   ├── collab/     # solo.md / team.md (exactly one is always loaded)
            │   └── capability/ # graph.md / curated.md (loaded per detected bits; may be none)
            │                   # + context-engineering.md (full design of the curated asset layer)
            ├── assets/         # templates: spec / plan / test / config snippets / cards
            └── scripts/ctx/    # ctx CLI (Node.js, cross-platform): query code facts, no MCP required
```

> **How the two skills divide the work**: `ai-prd` turns a raw idea into a PRD → that PRD is the input of `ai-dev-workflow` Step 1 → the workflow carries on with Overview / Spec / Coding Plan / tests. To invoke `ai-prd`, just say "write me a PRD / turn this requirement into a requirements doc".

> **Communication boundary**: all user-facing communication uses business language. Users confirm the big architecture; module-level design is constrained through business questions only; detailed program design is completed autonomously by AI and engineering. `ai-prd` conversations and deliverables never require the user to understand implementation details.
>
> **Development isolation**: once inside `ai-dev-workflow`, every document or code change lands in a dedicated git worktree first — Lean changes included. After all work and gates complete, the branch auto-merges into main; on failure the worktree is preserved, the user's uncommitted changes in the main working tree are never touched, and PR / CI / protected-branch rules are never bypassed.

Design and implementation docs: `docs/spec/2026-07-06-ai-dev-system-design.md` and `docs/plan/2026-07-06-ai-dev-system.md` (in Chinese).

---

## Install

**Option A: npx per-project install (recommended)** — run one command at the target project root. npx fetches the installer entry from GitHub; the installer then pulls the skill package from the official repo's `main` branch and installs into both `.claude/skills/` (Claude Code) and `.agents/skills/` (Codex). Requires Node.js 20+, npm, and Git.

```bash
# Run at the target project root — macOS, Linux, Windows:
npx --yes github:weidwonder/ai-dev-system .

# Dry-run first, nothing written:
npx --yes github:weidwonder/ai-dev-system . --dry-run

# Install a specific branch or tag, for canary or rollback:
npx --yes github:weidwonder/ai-dev-system . --ref=<branch-or-tag>
```

Common flags: `--shared` commits the Claude Code project settings for the whole team; `--keep=<plugin-short-name>` keeps a specific conflicting plugin; `--no-plugins` installs skills only; `--yes` skips the installer's own confirmation; `--no-codegraph` skips the codegraph step; `--codegraph-location=global` wires codegraph into every project instead of just this one. See all flags with `npx --yes github:weidwonder/ai-dev-system --help`.

> The leading `npx --yes` only skips npm's download prompt; the installer still asks once before modifying your project. For fully unattended installs, pass `--yes` again after the target directory: `npx --yes github:weidwonder/ai-dev-system . --yes`.

**Option B: local script install (repo maintenance & troubleshooting)**

```bash
# With this repo already cloned:
node /path/to/ai-dev-system/install.mjs .

# Windows wrapper also works:
#   \path\to\ai-dev-system\install.cmd .

# Only for developing/testing unpublished changes of this repo:
node /path/to/ai-dev-system/install.mjs . --source-dir=/path/to/ai-dev-system
```

What the installer does:

1. Fetches the `--ref` version of the `--repo` repository from GitHub and verifies it contains at least one valid skill; if download or verification fails, the target project is left untouched;
2. Copies **all** skills of that version (by default `ai-prd` + `ai-dev-workflow` with the `ctx` CLI) → `<project>/.claude/skills/` for Claude Code;
3. Copies the same skills → `<project>/.agents/skills/` for Codex;
4. Merges (never overwrites) Claude Code's `enabledPlugins`, disabling conflicting plugins **for this project only**;
5. Prompts how to handle conflicting Codex skills: project-level `AGENTS.md` auto-trigger constraints (default), or explicit global uninstall through the Codex CLI; if either entry file already has a workflow marker block, both `CLAUDE.md` and `AGENTS.md` are reconciled;
6. Links the bundled `ctx` CLI as a **global `ctx` command** (`npm link` inside `<project>/.claude/skills/ai-dev-workflow/scripts/ctx`) and verifies it by actually running `ctx --help`. If linking fails (no write permission, npm global bin not on PATH, an existing `ctx` command), it degrades to a warning and prints the `node <skill>/scripts/ctx/src/cli.js <command>` fallback — the CLI itself ships with the skill, so **a missing command never means ctx is unavailable**. Skip with `--no-ctx-link`;
7. Keeps [codegraph](https://github.com/colbymchenry/codegraph) (local code knowledge graph CLI) up to date — `npm install -g @colbymchenry/codegraph` when missing, `codegraph upgrade` when outdated — then wires it into your agents (`--location=local` by default, this project only) and builds the project index with `codegraph init` unless `.codegraph/` already exists. Every failure here degrades to a warning; skip the whole step with `--no-codegraph`. Codex CLI has no project-local MCP config, so project-level wiring skips it and the installer prints the manual global command.

| Plugin | Why it conflicts with this pipeline |
|---|---|
| Claude Code `superpowers` | brainstorming HARD-GATE + `using-superpowers` forced preamble hijacks Triage / direct implementation |
| Claude Code `everything-claude-code` | plan/tdd/coding-standards overlap + SessionStart hook injection |
| Claude Code `oh-my-claudecode` | autopilot/ralph/ultrawork end-to-end engines replace this pipeline + agents-overlay hook |
| Claude Code `general-task` | SessionStart injects clarify→plan→execute + `using-general-task` forced preamble (disabled by default too; `--keep=general-task` to retain) |
| Codex `superpowers@openai-api-curated` | the default is a project `AGENTS.md` auto-trigger constraint; an explicit install choice can globally uninstall the plugin through the Codex CLI |

> **Why project-only disabling works**: Claude Code settings precedence is Managed > Local (`.claude/settings.local.json`) > Project (`.claude/settings.json`) > User (`~/.claude/settings.json`), and `enabledPlugins` is honored at every scope. A project-level `false` overrides a user-level `true`, so these plugins are switched off **in this project only**.
>
> Codex installs default to a project-level `AGENTS.md` auto-trigger constraint instead of editing `~/.codex/config.toml`, so installing skills for one project never affects the others. During an interactive install, you may explicitly choose global uninstall; use `--codex-conflicts=uninstall` for automation. Global uninstall requires the Codex CLI and affects all projects for the current user.
>
> ⚠ Two prerequisites: ① a project-level `.claude/settings.json` triggers a **workspace trust** dialog on first open — it takes effect after you trust it; ② settings / `AGENTS.md` changes take effect on the **next start** of Claude Code / Codex, not the current session. To undo, delete the corresponding `false` entries in the project settings, or remove the `ai-dev-system:codex-conflicts` block from `AGENTS.md`.

**Option C: one-time global install** — shared by all projects, but you must weigh the conflicting plugins yourself (globally installed means globally active, which may interfere with this pipeline).

```bash
cp -r ai-dev-system/skills/ai-prd ai-dev-system/skills/ai-dev-workflow ~/.claude/skills/
cp -r ai-dev-system/skills/ai-prd ai-dev-system/skills/ai-dev-workflow ~/.codex/skills/
```

Then invoke the skill in any project (mentioning "AI-assisted development / dev workflow / generate a spec / coding plan" triggers it). The first call runs a one-time **initialization**: it asks exactly one question — **is anyone else developing this project with you** — writes the answer into the project root `CLAUDE.md` and `AGENTS.md`, and never asks again. What code-fact assets the project has is **never asked**; it is detected at every run.

> **Codex users**: project-level skills are installed under `<project>/.agents/skills/`; the **user-level** entry point is `~/.codex/skills/` (Codex has no `~/.agents/` user-level directory — don't install there). Codex reads `AGENTS.md`; initialization writes it too, recording the collaboration surface, the merge gate, and `ctx` usage. The `ctx` CLI is invoked via plain shell, so it works across tools.
>
> **Document directories**: specs go to `docs/spec/`, plans to `docs/plan/`, reports to `docs/report/` — no tool-named directories, no deliverables scattered at the project root.

---

## Quick Start

### Working solo
1. Invoke the skill in your project → answer "just me".
2. Describe your requirement. The AI creates an isolated worktree first; small changes go through a one-page Lean Spec, large ones escalate to the full pipeline.
3. After all verification passes, the branch auto-merges into main and the worktree is cleaned up — no second confirmation needed.

> Solo does **not** mean you need no code-fact assets. Once a project grows, "the same capability has two implementations and I edited the wrong one" happens regardless of headcount — that is what the curated bit below is for.

### Working with others
1. Invoke the skill in your project → answer "others too", and confirm the merge gate (merge locally / push a PR and let the platform merge).
2. From then on, the AI creates a dedicated worktree per repo, produces an Overview before review meetings for anything spanning ≥3 repos, and aligns with the repo owner before touching someone else's repo.
3. When all repos are ready, changes merge in dependency order through PR, CI, and protected-branch gates.

### Building code-fact assets (**any project size — independent of headcount**)

When the project starts having "the same capability implemented in several places, and it's unclear which is authoritative", build the **curated bit**:

```bash
ctx init --minimal                                    # capability registry only — three rows is enough to start
ctx init                                              # full scaffold when you need it (cards + scenes + probe-set + glossary)
node <skill>/scripts/ctx/src/cli.js init --minimal    # equivalent fallback if the global command is unavailable
```

From then on the AI uses `ctx discover "<intent>"` to locate authoritative code entities instead of grepping stale code — every fact carries a traceable cite.

When the project grows to "I have to sweep the repo before I can find anything", build the **graph bit** (a local code-graph index; the installer already handles this step).

> You don't have to watch for either of these yourself: the AI accumulates signals whenever **actual rework happens** (edited a non-authoritative copy, misled by a stale implementation, forced to explore many unregistered modules), and after two of them raises one concrete suggestion in the wrap-up report. It records outcomes only — never "that search felt tedious" — and once you decline, it never raises the same one again.

---

## ctx CLI at a Glance

| Command | What it does | Status |
|---|---|---|
| `ctx init` | Scaffold the engineering-context directory | ✅ |
| `ctx discover "<intent>"` | Intent → cards to load + out-of-scope warnings | ✅ |
| `ctx get-card <repo> [section]` | Fetch a repo's Codebase Card | ✅ |
| `ctx find-scenes <keywords>` | End-to-end business scene blueprints | ✅ |
| `ctx list-services` | List registered repos/capabilities | ✅ |
| `ctx search-semantic "<q>"` | Semantic fallback when discover misses (local vector similarity) | ✅ |
| `ctx probe` | Run the Frozen Probe Set anti-rot gate (self-check + ratchet + decay report) | ✅ |
