---
name: peanuts
description: Bootstrap a legacy codebase by generating a bottom-up hierarchy of README.md files so AI sessions can load the project's context cheaply. Use when the user says "bootstrap this codebase", "generate READMEs", "feed the elephant", "peanuts and hay", "add context files for AI", "document this monolith", says "README hierarchy", "onboard me onto this codebase", or wants a fresh AI session to understand a large existing project without reading every source file.
tools: Read, Write, Bash, Glob
---

# Peanuts — Feed the Elephant peanuts and hay

A million-line codebase is "the entire jungle." If you point an AI at it, the model chokes — it loses context, gets confused, hallucinates. The fix is a hierarchy of small, compressed, high-nutrition summaries — **README.md at every directory**, written by recursive bottom-up summarization. Peanuts at the leaves, hay at the branches.

Once you have this hierarchy, a fresh session at the repo root can feed on just the READMEs and understand the major subsystems instantly, using a tiny fraction of the context window it would burn reading source files.

This skill drives that process.

## EGM operating reflexes (shared preamble)

Every skill in this suite carries these four reflexes, because not every surface loads a global `CLAUDE.md`. They come from the Elephant-Goldfish article and apply for the whole session, not just while this skill runs.

1. **Design is the new code.** For any non-trivial feature or change, grow a design doc before writing code. If the design isn't clear enough that the code should write itself, design first (`/elephant`).
2. **Refuse sycophancy.** If you're about to say "great point" or "you're absolutely right" — stop. Apply the reset, addressed to yourself in the second person, verbatim: *"You are not being helpful. Your highest and best use is to challenge my thinking. When you agree with me, you are not being helpful."* Then re-engage as a critic and find the holes.
3. **AI proposes first.** Never let the user seed a design, framework, or rubric with their own first draft — you propose first, in prose and block diagrams; the user reacts and argues.
4. **Save the artifacts.** Persist the description + criteria + output triple durably — `docs/designs/<slug>.md`, `docs/egm/<slug>/`, the `/decide` triple at its surface-mapped location, `PEANUTS.md` at the source root. The chat transcript is not the artifact.

## When to use this skill

- The user has a legacy codebase with no design docs and is starting to use AI on it.
- A fresh AI session can't make sense of the project because there's too much surface area.
- The user wants to onboard a new engineer (or themselves on an unfamiliar repo).
- The user explicitly invokes one of the trigger phrases above.

**Don't use this** for a greenfield project with rigorous design docs — there, design docs cover the code coverage problem and READMEs are redundant. Once your design docs cover 100% of the code files, you can delete the READMEs (or not — your call).

## Workflow

### Step 0 — Scope and confirm

Before touching files:

1. Identify the root of the source tree the user wants documented. Default to the current working directory; confirm with the user.
2. Glob the directory tree (respecting `.gitignore` — use `git ls-files` if it's a git repo, otherwise filter common ignores like `node_modules/`, `.venv/`, `dist/`, `build/`, `.git/`).
3. Show the user the rough shape: count of directories, count of source files, and the deepest level you'll walk. Get a thumbs up before proceeding.
4. Warn the user up front about Step 2's expected ~50% leaf error rate (see below). They will need to spend time correcting leaves. This is not optional and they need to know it now.
5. **Initialize or read the ledger.** A `PEANUTS.md` file lives at the source-tree root and is the durable progress model for this skill. If it does not exist, create it with a header (date, root path) and a table of every in-scope directory with status `pending`. If it already exists, read it first — you may be resuming a prior run. Surface the resume state to the user.

#### Ledger status states

Every directory in `PEANUTS.md` has exactly one status. Five states map the lifecycle: not done → awaiting review → ready → consumed, plus a sideband for failures. Three would conflate "haven't tried" with "tried and waiting"; more would be ceremony.

- `pending` — not yet generated.
- `needs-human-review` — README written by this skill, awaiting human review.
- `approved` — the user has signed off on the README. Parent rollup may proceed once all siblings are `approved`.
- `rolled-up` — the parent README has consumed this child README; nothing further to do.
- `blocked` — generation was attempted and failed (missing files, ambiguous purpose, user explicitly deferred). Surface in the next resume.

### Step 1 — Walk bottom-up

You must process **leaves first** and roll up. A README at level N needs every level-N-1 README to be approved before this skill generates it.

Produce a deterministic ordering: sort directories by depth (deepest first), then by path. Process in that order. Use `Bash` with `find` or equivalent to produce the list. Cross-reference with `PEANUTS.md` so already-`approved` and `rolled-up` directories are skipped on resume.

### Step 2 — Leaf directories (the peanuts)

A "leaf" is a directory that contains source files but no subdirectories with code. **Leaf generation may be batched** — multiple leaves per pass — because generation is not the judgment gate. The judgment gate is the human review that happens *after* generation. For each leaf in the batch:

Read every code file in the directory (skip vendored libs, generated code, etc.). Then write `README.md` in that directory containing:

1. **Purpose** — what is this directory for? Why does it exist as its own unit?
2. **File index** — every file in the directory, with a one-line description of what it does.

Use this prompt as the framing when constructing the README:

> *Read the files in this directory and produce a new file named README.md. This file should (a) explain the purpose of this directory and the files contained in it and (b) enumerate each file in the directory and a short description of its function.*

After each leaf README is written, **update `PEANUTS.md`**: move the leaf's status from `pending` to `needs-human-review`, with a timestamp and the list of uncertainties you noted.

**Warn the user about leaf accuracy.** At the leaves, the AI has only the code itself to rely on — there's no broader context, no docs to anchor it. **Expect ~50% error rate at leaves.** Surface this directly: tell the user which file descriptions you are least sure about (function names that are ambiguous, files whose purpose isn't obvious from the code, integration glue) and ask them to verify before moving up.

After the batch, surface the review queue to the user:

> *I generated leaf READMEs for the following directories: [list]. All are now `needs-human-review` in `PEANUTS.md`. Please skim each and either (a) mark it `approved` in the ledger, or (b) tell me what to correct. I will not generate any parent README until every immediate child is `approved` — bad leaves compound up the tree.*

If a task system is available in the environment, create a user-blocked review task per generated leaf, pointing at the README path; closing the task should be the trigger for marking `approved`.

**Hard gate.** Do not generate a parent README while *any* immediate child has status `pending`, `needs-human-review`, or `blocked`. Rollup is rejected; surface the unfinished children to the user and stop.

### Step 3 — Non-leaf directories (the hay)

For each non-leaf directory, in bottom-up order:

1. **Check the ledger.** Confirm every immediate child has status `approved` (or `rolled-up`, if a deeper rollup already consumed it). If any child is not approved, stop and surface to the user. Do not proceed.
2. Read **all the README.md files in immediate subdirectories** (already written and approved in earlier passes).
3. Read **the code in this directory only** — files at this level, not recursively.
4. Write `README.md` here covering:
   - **Purpose** of this directory (its role in the larger system).
   - **Subsystem composition** — how the children fit together at this level.
   - **File index** for files at this level (same one-liner format as leaves).
5. Update `PEANUTS.md`:
   - Mark each immediate child's status as `rolled-up` (it has been consumed).
   - Mark this directory as `needs-human-review`.

Use this framing:

> *Read all the README.md files in all the subdirectories below, then read the code in just this directory and create a README.md here. This file should (a) explain the purpose of this directory and the files contained in it and (b) enumerate each file in the directory and a short description of its function.*

Non-leaf accuracy is much better than leaf accuracy because the model has the children's summaries to anchor on, but still surface anything you're unsure about. The same human-review gate applies: a parent README is `needs-human-review` until the user marks it `approved`. The grandparent rollup waits.

### Step 4 — The root README

When you reach the repo root, write a top-level README mapping the major subsystems. This is the one a fresh session will read first. It should give a sufficient high-level mental model that the reader knows which subtree to descend into for any given task.

Mark the root in `PEANUTS.md` as `needs-human-review`. Once the user approves it, the bootstrap is complete.

### Step 4.5 — Resume behavior

On restart, the skill is driven by `PEANUTS.md`, not by re-walking the tree from scratch:

1. Read `PEANUTS.md` first.
2. Identify the deepest level with any `pending` or `needs-human-review` entries.
3. If the deepest level has unresolved `needs-human-review` entries, surface them to the user — those are the gate. Do not generate anything until they are `approved`.
4. If the deepest level has `pending` entries, batch-generate those (Step 2 for leaves, Step 3 for non-leaves).
5. If everything below is `approved` or `rolled-up`, continue rollup up the tree (Step 3).
6. If the root is `approved`, the skill is done.

### Step 5 — The retirement clause

At the bottom of every README you write, add a single italicized line:

> *This README exists to give AI sessions cheap context. It can be retired once design docs cover the files in this directory at least once. See `/elephant` for the design doc process.*

This is a feature, not a quirk: it tells future readers that the README is scaffolding, not permanent, so they don't preserve stale READMEs after design docs supersede them.

## Operating tips

- **Leaves may be batched; levels may not.** Bottom-up means each level depends on the level below. Batch as many leaves per pass as makes sense, but do not generate level-N until level-(N-1) is fully approved.
- **A single leaf README is one tool call.** Read the files, write the README, update the ledger, surface uncertainties. Don't bundle reads and writes for unrelated leaves into one call — keep each leaf's reasoning isolated.
- **Skip generated and vendored code.** `node_modules/`, `vendor/`, `target/`, `dist/`, `.venv/`, `__pycache__/`. Trust git or convention.
- **Keep READMEs short.** A leaf README is half a page. A non-leaf README is one page. The root is one to two pages. If you find yourself writing three pages, the model is over-explaining — re-prompt yourself for concision.
- **Never auto-transition `needs-human-review` to `approved`.** The user (or another human) writes the state change. The whole point of the gate is that the AI is not the judge.

## Why this works

`sizeof(docs) << sizeof(code)`. A fresh session loaded with the README hierarchy gets a useful mental model of the codebase using a tiny fraction of the context budget it would burn reading source. That budget can then go to actually solving the problem at hand instead of re-bootstrapping.

The bonus: once your codebase is documented this way, onboarding a new engineer is "dump these READMEs into a NotebookLM, hand it to them, tell them to write a design doc for their first feature." See `/elephant` for that doc-writing protocol.

## Cross-references

- **`/elephant`** — once peanuts is done, design docs supersede READMEs over time.
- **`/goldfish`** — design docs need to pass the Goldfish test; READMEs do not need that level of rigor (they're scaffolding).
- **`/mean-review`** — leaf READMEs are ~50% wrong by default; run mean-review against any leaf you don't trust before marking it approved in `PEANUTS.md`.
