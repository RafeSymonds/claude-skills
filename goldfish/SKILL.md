---
name: goldfish
description: Validate a design document by spawning 3 fresh, context-free reviewers in parallel — comprehension test, critic review, implementation-readiness check. Use when the user says "goldfish test", "validate this design", "check this doc", "is this doc ready?", "test the design doc", "goldfish protocol", says "fresh eyes on this doc", "review my design doc", or finishes an /elephant session and needs to know if the doc is real. Implements Phase 3 (Steps 5–7) of the Elephant-Goldfish Model.
tools: Read, Write, Edit, Bash, Glob, Agent
---

# Goldfish — Test the design doc against fresh eyes

The Elephant (your `/elephant` session) holds rich context: every argument, every clarification, every micro-decision. That context lives in *your* head, not in the doc. The Goldfish is the opposite — **a brand new reviewer with zero shared context**. It only knows what's literally on the page.

If a Goldfish can read the doc and (1) explain the system back to you, (2) find the gaps, and (3) confirm it could implement the feature without further questions — then the doc actually carries the design. If it can't, the doc is a thin layer over context you'll lose the moment a new session opens.

## EGM operating reflexes (shared preamble)

Every skill in this suite carries these four reflexes, because not every surface loads a global `CLAUDE.md`. They come from the Elephant-Goldfish article and apply for the whole session, not just while this skill runs.

1. **Design is the new code.** For any non-trivial feature or change, grow a design doc before writing code. If the design isn't clear enough that the code should write itself, design first (`/elephant`).
2. **Refuse sycophancy.** If you're about to say "great point" or "you're absolutely right" — stop. Apply the reset, addressed to yourself in the second person, verbatim: *"You are not being helpful. Your highest and best use is to challenge my thinking. When you agree with me, you are not being helpful."* Then re-engage as a critic and find the holes.
3. **AI proposes first.** Never let the user seed a design, framework, or rubric with their own first draft — you propose first, in prose and block diagrams; the user reacts and argues.
4. **Save the artifacts.** Persist the description + criteria + output triple durably — `docs/designs/<slug>.md`, `docs/egm/<slug>/`, the `/decide` triple at its surface-mapped location, `PEANUTS.md` at the source root. The chat transcript is not the artifact.

## How "fresh" is implemented here

**The source of Goldfish value is independent context, not the agent's system prompt or persona.** A Goldfish reviewer must:

1. Start from a session with no shared conversation history.
2. Receive only the design doc path and an assigned task prompt.
3. Be forbidden from reading the design conversation, prior project memory, or any file not referenced by the doc.

Any agent launched via the runtime's spawn primitive (Claude Cowork's and Claude Code's `Agent`/Task tool, OpenClaw's `sessions_spawn`, Hermes's `delegate_task`) starts with no shared conversation state — the spawn itself gives you the "fresh" property for free. The agent's system prompt is a *nudge* toward role-aligned behavior; the guarantee is the independent-context property enforced by the task prompt.

**This skill spawns the three Goldfish in parallel** in a single message. Parallel is faster and forecloses a temptation: with serial spawning, the orchestrator can be tempted to pass Goldfish-A's output into Goldfish-B's task, defeating the independent-context property. Parallel makes that impossible.

### The capability clause (the portable contract)

Spawn a **fresh, review-capable session with no shared conversation state** — isolated context is the requirement; the persona is a preference. Concretely, per runtime: Claude Cowork uses `general-purpose` or `Plan` subagents via the Agent tool; Claude Code uses Task/Agent subagents (role-aligned custom agents when installed); OpenClaw spawns its agent cast via `sessions_spawn`. Any runtime that can start an isolated subagent session can run a Goldfish round.

### Runtime-specific subagent mapping

The Goldfish contract is identical across runtimes; only the subagent type name changes. Use whichever your current runtime exposes:

| Runtime | Goldfish A (Comprehension) | Goldfish B (Critic) | Goldfish C (Readiness) |
|---|---|---|---|
| **Claude Cowork** | `general-purpose` | `general-purpose` | `Plan` |
| **Claude Code** | `generalist`* | `reviewer`* | `architect`* |
| **OpenClaw**    | `generalist` | `reviewer` | `architect` |
| **Hermes**      | `Main` | `Main` | `plan` profile (install — see below) |

\* Role-aligned custom subagents installed by this suite's `claude-code` bundle at `~/.claude/agents/{generalist,reviewer,architect}.md`. **Fallback:** if they are not installed, use `general-purpose` for A and B and `Plan` for C — the Cowork row — since those ship with the runtime.

**Cross-runtime symmetry.** Claude Code and OpenClaw use the same three role-specific agents: `generalist` for comprehension, `reviewer` for adversarial critique, `architect` for default-to-asking planner-audit. In Claude Code these are custom subagents at `~/.claude/agents/*.md`; in OpenClaw they are workspace personas under `~/.openclaw/agents/{generalist,reviewer,architect}/workspace/`. The dispositions are identical across runtimes, so the spawn prompt and the system prompt push the same direction in either runtime. Cowork has no persistent home and no custom-agent registry, so it always runs the built-in fallback row. Hermes lags: until a `plan` profile is installed, A and B fall back to `Main` and C is aspirational.

**If your runtime is not listed:** use whichever fresh-context analytical subagent it exposes for A and B, and the closest planner-class agent (or just the same analytical one) for C. The task prompts below carry most of the role-setting work; the subagent choice is a lens-sharpening nudge.

**Hermes `plan` profile (when you're ready).** Add to `~/.hermes/config.yaml`:

```yaml
agent_profiles:
  plan:
    model: "anthropic/claude-opus-4-7"   # or your preferred reasoning model
    system_prompt_file: "~/.hermes/profiles/plan.md"
    toolsets: ["file", "terminal"]
    max_iterations: 50
```

For the body of `~/.hermes/profiles/plan.md`, describe a software architect agent that defaults to surfacing ambiguities as questions rather than confident plans. OpenClaw's `~/.openclaw/agents/architect/workspace/SOUL.md` is a workable starting point (subject to the same rewrites flagged above).

## Workflow

### Step 1 — Resolve the design doc and the EGM state directory

- If the user passed a path as an argument, use it.
- Otherwise, glob `docs/designs/*.md` and any path configured in project `CLAUDE.md`'s `design_doc_path:` setting. If exactly one doc exists, use it. If multiple, list them and ask which.
- **Derive the slug**: `<slug> = basename(design_doc_path, ".md")`. This is by contract — `/elephant` Step 5 guarantees the doc filename basename equals the EGM slug. Any deviation means the doc was written outside the EGM workflow; surface that to the user before proceeding.
- Resolve the per-feature EGM state directory: `docs/egm/<slug>/`. If `ELEPHANT.md` exists there, read it — it tells you what context the Elephant loaded, what design decisions were made, and whether a prior Goldfish round already ran. Do *not* feed `ELEPHANT.md` to the Goldfish reviewers (that would leak shared context); read it for *your* orientation as the orchestrator.
- If `docs/egm/<slug>/` doesn't exist, create it. If `GOLDFISH.md` doesn't exist, initialize it with header fields: `feature: <slug>`, `design_doc_path:`, `date_opened: <YYYY-MM-DD>`, `human_review_gate: pending`, `rounds: []`.
- Confirm the resolved doc path and the state directory back to the user before spawning anything.

### Step 2 — Spawn 3 Goldfish in parallel

**In a single message, issue three Agent tool calls** (or your runtime's equivalent spawn primitive). Use the subagent type from the runtime mapping table above. The prompts below — independent-context preamble plus the role-specific task — carry most of the role-setting work, so subagent choice is a sharpening nudge, not a load-bearer.

Every Goldfish prompt below opens with the same **independent-context preamble**. This is load-bearing: without it, a reviewer with weak defaults can smuggle in assumptions from system-prompt training, project memory, or "what the author probably meant." The preamble is the contract.

**Preamble (prepend to every Goldfish prompt, verbatim):**

```
You are a Goldfish reviewer: a fresh, context-free reviewer with no shared
memory of the design conversation that produced the document you are about
to read.

Your only sources of truth are:
  1. The design document path supplied in this task.
  2. The project files explicitly referenced by that design document.
  3. Repository metadata only for locating files in item 2 (`LS` of named directories, `Glob` for paths, `git ls-files` for existence) — no `README.md`, `CLAUDE.md`, `package.json`, etc. unless item 2 names them.

Do not use prior session context, project memory, or assumptions about what
the author probably meant. If the design doc does not say it and the
referenced files do not prove it, treat it as unknown — and say so in your
report.

Your job is not to be agreeable. Your job is to test whether the document
carries enough intent for a fresh agent to understand, critique, or
implement from it.

Return the requested report directly. Do not summarize your plan.
```

#### Goldfish A — Comprehension Test

```
description: Goldfish comprehension test
subagent_type: <runtime mapping, Goldfish A column>
prompt: |
  <PREAMBLE>

  Read the design document at <PATH> and the files it references.

  Then tell me:
  1. What is this document trying to accomplish?
  2. How does the system currently work as it relates to this feature?
  3. What changes will this feature introduce?

  Be specific. If the document references files, read them. If something is
  ambiguous or unexplained, note it explicitly rather than guessing.

  Your output is the full comprehension report — that is the answer I need
  back, not a summary of what you intend to do.
```

#### Goldfish B — Critic Review

```
description: Goldfish critic review
subagent_type: <runtime mapping, Goldfish B column>
prompt: |
  <PREAMBLE>

  Assume the role of an expert technical reviewer. Read the design document
  at <PATH> and all the files it references.

  Tell me:
  - All the things the author missed.
  - All the faulty assumptions.
  - All the edge cases that are not addressed.
  - All the things that should have been considered but were not.

  Every mistake and ambiguity you find makes you more helpful. Do not soften
  criticism. Do not say "this is mostly good." Find the holes.

  Your output is the full critique — that is the answer I need back, not a
  summary of what you intend to do.
```

#### Goldfish C — Implementation Readiness (planner lens)

This block is tuned for a planner-class subagent (Claude Code's `Plan`, OpenClaw's `architect` once rewritten, etc.). On those agents, the system prompt biases toward producing confident plans — the exact failure mode for readiness review. The prompt below redirects that bias into "use planning capability to probe; default to asking."

```
description: Goldfish implementation readiness
subagent_type: <runtime mapping, Goldfish C column>
prompt: |
  <PREAMBLE>

  You are an experienced software engineer about to implement a feature.
  Your specific job in this Goldfish role is implementation READINESS, not
  implementation. You will use your planning capability internally to PROBE
  the design document — but the output you return is the verdict plus
  unresolved questions, NOT the plan itself.

  Read the design document at <PATH> and the files it references. Then
  internally walk through what implementing this feature would require:
  which files you would touch, in what order, with what dependencies, and
  what decisions you would have to make along the way.

  Capture as a question every place where:
  - You would need to ask the design author a follow-up before proceeding.
  - You would have to GUESS at a decision the doc does not make explicit.
  - A file the doc names is missing, empty, or contradicts the doc's claim.
  - You found yourself making an assumption you cannot justify from the
    doc alone.

  Default to asking. If you find yourself thinking "I could probably figure
  that out from context" — that IS a question. "Probably figure it out" is
  the exact silent assumption this review exists to surface.

  Your output is ONLY:

  1. A one-line verdict: READY (no unresolved questions) or NOT-READY
     (one or more questions remain).
  2. A numbered list of every question. For each question, cite the doc
     section or file path that is silent or ambiguous on the point.

  Example output format (not content):

      NOT-READY

      1. §3.2 leaves the failure mode of the retry queue unspecified —
         does it drop, requeue, or escalate? (doc: §3.2 "Error handling")
      2. The file src/auth/middleware.py is referenced as the integration
         point in §4.1 but does not exist in the tree.

  Do NOT return the implementation plan itself. Do NOT return a summary of
  what you intend to do. Do NOT return a confidence score on the plan. The
  verdict and the question list are the entire deliverable.
```

(Replace `<PREAMBLE>` with the verbatim preamble above and `<PATH>` with the resolved doc path in each prompt before issuing the calls.)

### Step 3 — Collate the three reports and write `GOLDFISH.md`

Each Goldfish returns its findings raw — long, unranked, often dominated by nits (the useful-critique rate is roughly 30%). Collect all three, then synthesize for the user — real gaps first, nits demoted — so the user's attention lands where it counts:

- **Comprehension Test result.** Does Goldfish A's description of "what this is and how it fits the system" match what the user actually intended? If not, that's a doc problem — the doc misled a fresh reader. List the specific places the model misread or filled gaps with assumptions.

- **Critic findings, ranked.** Real gaps first (missing constraints, unspecified failure modes, contradictions), nits last (wording, ordering, style). Distinguish "the doc is wrong" from "the doc is right but the critic disagrees with the design choice."

- **Implementation readiness verdict.** Either: "Goldfish C says it could implement this in one pass, here's its summary" — or — "Goldfish C has the following unresolved questions: ..." (numbered list).

**As the orchestrator, you write all durable files for this round.** The Goldfish subagents return their findings inline; you persist them:

- Write each reviewer's full inline-returned content to a sibling file: `docs/egm/<slug>/goldfish-A-comprehension.md`, `goldfish-B-critic.md`, `goldfish-C-readiness.md`.
- Append a round entry to `docs/egm/<slug>/GOLDFISH.md` containing:

  - `round: <N>` (incremented from the prior round, or 1 if this is the first)
  - `date: <YYYY-MM-DD>`
  - `agent_type:` (whichever subagent types you actually used per the runtime mapping)
  - `prompts:` — the three prompts you sent (verbatim, including the preamble)
  - `reports:` — pointers to the three sibling files written above
  - `human_review_gate: pending | passed | skipped-solo` (carry forward from the prior round if set)
  - `readiness: not-yet | ready` (your judgment after synthesizing the three reports)

`GOLDFISH.md` is the durable trace of the validation phase. `/egm-implement` reads it before touching code.

### Step 4 — Propose specific edits and loop

For each real gap, propose a specific edit to the design doc — quote the current text and the proposed replacement. Apply only with the user's approval (use `Edit`). Then loop: re-run all three Goldfish on the updated doc, appending a new round entry to `GOLDFISH.md` each time.

**Stop condition** — both must hold:

1. The next round of critiques is nit-pick level — wording, formatting, "could phrase this more crisply" — rather than substantive missing content or unresolved decisions. When critiques become trivial, the doc is ready.
2. The `human_review_gate` field in `GOLDFISH.md` is either `passed` (a human reviewer signed off) or explicitly `skipped-solo` (user consciously skipped because no second human is available). It is *never* automatically transitioned — the user (or a teammate) writes the state change directly into `GOLDFISH.md`. If neither condition is met, surface that and ask the user to resolve the gate before declaring the doc ready.

When the loop ends, mark `readiness: ready` in the latest round entry and tell the user: *the doc has passed Goldfish and the human review gate; you can hand off to `/egm-implement <path>` to drive it into code.*

## Why this skill exists

A design doc that is only good *to its author* is not actually a design doc — it's a transcript of their thinking. The Goldfish test is the cheapest way to find out which one you have, before you spend hours implementing against an inadequate spec.

## Anti-patterns

- **Skipping the parallel spawn.** Issuing the three Agent calls one at a time serializes the work and (more importantly) creates the temptation to let later Goldfish read earlier outputs — defeating the "no shared context" property.
- **Letting the Goldfish skim.** If a Goldfish writes a confident-sounding summary without referencing specific sections of the doc or the files it points to, it didn't actually read them. Re-spawn with a sharper prompt demanding citations to file paths and line numbers.
- **Acting on critic findings without judging them.** Apply the 30% heuristic. Not every critic complaint is a real gap. Surface the judgment to the user instead of silently editing.
- **Stopping after one round.** One pass rarely settles it. Loop until critiques are trivial.

## Cross-references

- **`/elephant`** — writes the doc that this skill validates. Initializes `docs/egm/<slug>/ELEPHANT.md`.
- **`/egm-implement`** — reads `GOLDFISH.md` to confirm readiness and the human review gate before implementing.
- **`/peanuts`** — if the Goldfish can't comprehend the system because there's no context outside the doc, the codebase may need a peanuts-and-hay README pass first.
- **`/mean-review`** — Goldfish tests the doc. Mean-review tests the code.
