# dw-system — Ship With AI, Reliably

**English** | [中文](./README_zh.md)

![Node ≥20](https://img.shields.io/badge/Node-%E2%89%A520-brightgreen) ![Zero runtime dependencies](https://img.shields.io/badge/dependencies-zero-blue) ![Claude Code · Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%C2%B7%20Codex-8A2BE2) ![Cross platform](https://img.shields.io/badge/platform-macOS%20%C2%B7%20Linux%20%C2%B7%20Windows-lightgrey) ![License: MIT](https://img.shields.io/badge/license-MIT-yellow)

**Eight skills for Claude Code and Codex that turn a raw requirement into tasks a zero-context AI agent can execute dependably** — through Triage, top-level design, engineering specs, coding plans, coding, review, and tests. Prompting harder doesn't make AI coding reliable; engineering does.

It is distilled from an AI-assisted development system **proven in real production across 50–60 brownfield repositories under bi-weekly, high-velocity iteration**. Each skill has one job and loads only when the workflow reaches its step.

```bash
# Run at your project root — macOS, Linux, Windows. Needs Node.js 20+, npm, and Git.
npx --yes git+https://github.com/weidwonder/dw-system.git .
```

[Quick Start](#quick-start) · [Why Teams Pick It](#why-teams-pick-it) · [How It Works](#how-it-works) · [What's Inside](#whats-inside) · [ctx CLI](#ctx-cli-at-a-glance) · [Install Options](#install-options) · [Documentation](#documentation) · [License](#license)

---

## Quick Start

1. **Install** with the command above. An interactive install may ask a question or two first ([which ones](./INSTALL.md#per-project-install)), then prints its plan and asks you to confirm before changing anything. Restart Claude Code / Codex afterwards — project settings and instructions take effect in the next session.
2. **Describe a change** in Claude Code or Codex, for example:

   > Use dw-workflow: add an "order source" column to the order CSV export.

   Mentioning "AI-assisted development", "dev workflow", "generate a spec" or "coding plan" triggers it too. No PRD yet? Say "write me a PRD for …" and `dw-prd` produces one, which then becomes the workflow's input.
3. **Answer the one-time setup.** The first call asks one question — is anyone else developing this project with you — and, in the same batch, proposes how finished work goes back to main for you to confirm: merged locally, or pushed as a PR for the platform to merge. If it finds rules, skills or agents that conflict with this workflow, you decide how to handle each one in the same batch. The answers are written into `CLAUDE.md` and `AGENTS.md`, and you are not asked again.

What happens next, for that CSV example:

| Stage | What the AI does | Where you come in |
|---|---|---|
| Isolate | Creates a dedicated git worktree; your main working tree is never touched | — |
| Facts | On the first run, scaffolds `engineering-context/`. Looks up where export columns are defined with `ctx`; when no card covers it, reads the source and writes the card | — |
| Triage | Four questions route this change to a one-page Lean Change Spec | — |
| Confirm | Lists every existing behavior the change alters, plus the spec's scope and acceptance criteria | You decide compatibility and approve the spec |
| Build | Implements, deletes superseded logic, writes the CHANGELOG entry, runs the spec's checks | — |
| Review | Sub-agents review the change axis by axis; P0/P1 findings get fixed | — |
| Merge | Merges locally and removes the worktree — or opens a PR, depending on your setup answer. If a gate or the merge fails, the worktree is kept, and PR, CI and branch-protection rules are never bypassed | With PRs, you approve |

A larger or riskier change takes the full pipeline instead: PRD clarification → Overview (when the change spans several repos or modules) → engineering spec → coding plan → coding → review → test spec → test code → end-to-end tests, with the same gates.

---

## Why Teams Pick It

- 🎯 **One-command install** into any project, for Claude Code and Codex at the same time. Setup asks one question and has you confirm one proposal, once; the code-fact layer is scaffolded for you, so there is no "tier" to pick.
- 🧠 **Engineering Context as the moat** — capability registry, fact cards split by business domain, end-to-end scene blueprints, a card health check (`ctx lint-cards`), a frozen probe set as an anti-rot gate. Every fact is cited (`path#anchor @confirmed-date`); **no cite = treated as hallucination**.
- 🪶 **Zero runtime dependencies** — pure Node.js standard library + markdown. No build step, no lockfile drift, nothing to babysit.
- 🔒 **Discipline built in, not bolted on** — a git worktree for every change, merging only after all gates pass, RFC 2119 spec writing with zero placeholders, and YAGNI / KISS / DRY / LoD for both designs and code.
- 🗣️ **You only answer business questions** — you confirm the big architecture; module-level design is constrained through business questions; detailed program design is done by the AI. Nothing asks you to understand implementation details.
- ⚖️ **Right-sized process** — a 4-question Triage sends small changes to a one-page Lean Change Spec and real risk (AI behavior, security, cross-service, irreversibility, external commitments) to the full pipeline.

---

## How It Works

### Two governing principles

The whole system follows two rules, and teaches them to your project:

1. **Every fact has exactly one home — everywhere else only links to it.**
2. **Normative text has a size budget — when over budget, relocate first, condense second, raise the ceiling last.**

### One mandatory foundation: the code-fact layer

Every project that installs dw-system maintains `engineering-context/`: a capability registry, one map card per repo, and one domain card per business domain. There is no switch and no tier, regardless of project size or headcount.

The first invocation scaffolds it inside the task worktree (`ctx init`). A scaffold holding nothing but template placeholders is the normal starting state. From then on the rule is: *need a fact about a module? Check the card first. No card? Read the source, then write the card on the spot* — committed on the same task branch, never deferred. The AI runs `ctx discover "<intent>"` to locate the authoritative implementation instead of grepping stale code.

The cost is honest: the first few tasks on an existing codebase are slower, because reading source and writing cards is real work. It gets faster from there, and remembering stops being your job.

> **Why it is mandatory**: any "which tier does this project need" rule lags behind the project's real risk. A 100,000-line legacy system maintained by one person has no cards yet — exactly the project a tier rule would wave through with "just grep the old code", which is the failure mode this system exists to kill. Whether AI coding lands in production is decided less by the process (anyone can copy a process) than by **whether you can hand the AI a trustworthy layer of code facts**.

### What varies per project

| Setting | How it is set | What it decides |
|---|---|---|
| **Collaboration surface** — is anyone else developing with you | Asked once at setup, stored in `CLAUDE.md` / `AGENTS.md` | Whether to align with repo owners before touching their repos, hold review meetings for changes spanning ≥3 repos, and who decides compatibility trade-offs |
| **Merge gate** — local merge or PR | Proposed at setup for you to confirm, stored in the same block | Local merge: the branch merges after all gates pass and you tag releases yourself. PR: the PR carries the version bump and CHANGELOG version section, so **a merge is a release** and the merge commit gets tagged |
| **Code graph** — does the project have a local [codegraph](https://github.com/colbymchenry/codegraph) index | Detected on every run, never asked, never stored | Only how fast things are found (symbols, call chains, blast radius). It changes no process rule and never answers *which implementation to trust* — the cards do. Without it, heavy code exploration is handed to a sub-agent |

---

## What's Inside

```
.
├── install.mjs / install.cmd   # installer and its Windows wrapper
├── package.json                # npx entry
├── INSTALL.md                  # what the installer does to your project
├── CHANGELOG.md
├── dw-system/
│   ├── VERSION                 # current version; the installer fetches the matching tag
│   ├── migrations/             # per-version migration guides, printed by the installer on upgrade
│   └── skills/                 # eight skills shared by Claude Code and Codex; each = SKILL.md + references/ + assets/ + scripts/
│       ├── dw-workflow/        # the two principles, routing & setup, Triage, step order of both paths, confirmation gates, spec writing, tests
│       ├── dw-prd/             # PRD authoring from scratch: batched questions, three templates, HTML prototype (scripts/preview.mjs)
│       ├── dw-worktree/        # workspace isolation gate and completion/merge gate
│       ├── dw-code-facts/      # code-fact layer, the ctx CLI (scripts/ctx/), changelog & dependency declarations, code graph
│       ├── dw-bug-diagnosis/   # duplicate lookup, red loop, falsifiable hypotheses, regression guard
│       ├── dw-review-gate/     # code review gate: scope & backlog, object surfaces, review axes, sub-agent template, replacement ledger
│       ├── dw-doc-governance/  # where documents live, how long they live, how they retire; decision records
│       └── dw-prose/           # how to write normative text, comments, cards and prompts
├── docs/                       # this repo's own requirements, TODO, specs, plans, reports, decision records
└── test/                       # machine gates and tests for the installer, ctx and preview (not shipped)
```

**How the skills divide the work**: `dw-prd` turns a raw idea into a PRD; that PRD is the input of `dw-workflow` Step 1; the workflow fixes the order and loads each gate's own skill when it gets there. Every skill's entry states what it owns and which neighbour owns the rest.

---

## ctx CLI at a Glance

`ctx` ships inside `dw-code-facts` and is linked as a global command at install time. When the global command is unavailable, run `node <skill>/scripts/ctx/src/cli.js <command>` instead — the CLI is always on disk.

| Command | What it does |
|---|---|
| `ctx init` | Scaffold the `engineering-context/` directory |
| `ctx discover "<intent>"` | Intent → cards to load + out-of-scope warnings |
| `ctx get-card <repo> [domain]` | Fetch a repo's map card; with a domain, reads the domain card `cards/<repo>/<domain>.md` first |
| `ctx find-scenes <keywords>` | End-to-end business scene blueprints |
| `ctx list-services` | List registered repos (with their domains) / capabilities |
| `ctx lint-cards` | Card health check: fixed sections, size budget, resolvable cites and four more rules; existing violations go into a shrink-only baseline |
| `ctx search-semantic "<q>"` | Semantic fallback when discover misses (local vector similarity) |
| `ctx probe` | Run the Frozen Probe Set anti-rot gate (self-check + ratchet + decay report) |

Full reference: [`dw-system/skills/dw-code-facts/scripts/ctx/README.md`](dw-system/skills/dw-code-facts/scripts/ctx/README.md) (in Chinese).

---

## Install Options

```bash
# Per project (recommended): installs into .claude/skills/ (Claude Code) and .agents/skills/ (Codex)
npx --yes git+https://github.com/weidwonder/dw-system.git .

# Dry run — print the plan, write nothing
npx --yes git+https://github.com/weidwonder/dw-system.git . --dry-run

# Unattended — the leading --yes only skips npm's prompt; the one after the target skips the installer's
npx --yes git+https://github.com/weidwonder/dw-system.git . --yes

# Pin one release end to end — installer entry and skill source at the same tag (versions: dw-system/VERSION, CHANGELOG.md)
npx --yes git+https://github.com/weidwonder/dw-system.git#v<version> . --ref=v<version>

# Follow the development branch instead
npx --yes git+https://github.com/weidwonder/dw-system.git . --ref=main

# Machine-wide: ~/.claude/skills/ and ~/.codex/skills/, shared by every project; touches no project file
npx --yes git+https://github.com/weidwonder/dw-system.git --global

# All flags
npx --yes git+https://github.com/weidwonder/dw-system.git --help
```

Use the `git+https://` form, not the `github:weidwonder/dw-system` shorthand: the shorthand makes npm download a tarball that returns 404 in some environments (known on Windows + npm 12), while `git+https://` goes through `git clone` and avoids that path.

By default the installer fetches the tag matching its own `dw-system/VERSION`, so the installer and the skills it installs are the same version. If that tag has not been published yet, it warns and falls back to `main`; pass `--ref` explicitly to pin a version strictly. An explicit `--ref` that cannot be fetched fails with a non-zero exit code instead of installing something else. **To upgrade**, run the install command again; for versions that need manual steps, the installer prints the migration guide.

| Flag | Effect |
|---|---|
| `--dry-run` | Print the plan without writing anything |
| `--yes` | Skip the installer's confirmation |
| `--global` | Install into the user-level skill directories instead of a project |
| `--ref=<tag or branch>` | Install a specific version (default: the installer's own version) |
| `--shared` | Write plugin settings to `.claude/settings.json` (committed, applies to the whole team) instead of `.claude/settings.local.json` (git-ignored, only you) |
| `--keep=<plugin>` / `--no-plugins` | Keep one conflicting plugin / leave plugin settings alone entirely |
| `--docs-in-git=yes\|no` | Whether `docs/` and `engineering-context/` are committed to git (asked once otherwise; default `no`) |
| `--no-companions` | Skip installing the companion skills `agentic-principle` and `skill-principle` |
| `--no-ctx-link` | Don't link `ctx` as a global command |
| `--no-codegraph` / `--codegraph-location=global` | Skip codegraph entirely / wire it for every project instead of just this one |

**What the installer changes in your project** — every step, the conflicting plugins it switches off for this project only (four Claude Code plugins and Codex `superpowers@openai-api-curated`), global mode, notes for Codex users, and how to undo it — is in [INSTALL.md](./INSTALL.md).

---

## Documentation

- [`docs/index.md`](docs/index.md) — index of current design documents; [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — what this repo does today (both in Chinese)
- [`docs/decisions/`](docs/decisions/) — rationale and rejected alternatives (in Chinese)
- [`CHANGELOG.md`](CHANGELOG.md) — changes per version; [`dw-system/migrations/`](dw-system/migrations/) — manual steps for versions that need them

---

## License

[MIT](./LICENSE) © 2026 weidwonder
