---
name: egm-implement
description: Implement a feature from an Elephant-Goldfish-approved design doc with file-level guardrails, drift detection, and a handoff to /mean-review. Use when the user says "implement this design", "build the feature from the doc", "egm implement", "ship the design", "execute the plan", says "implement the design doc", or otherwise asks to turn a Goldfish-approved design doc in `docs/designs/` into code. Refuses to run until /goldfish is complete and the human review gate is resolved.
tools: Read, Write, Edit, Bash, Glob, Grep
---

# EGM Implement — Drive an approved design doc into code

`/elephant` writes the doc. `/goldfish` validates it. `/egm-implement` turns it into code — under guardrails that keep the implementation honest to the doc.

The skill exists because the link between *doc approved* and *code shipped* is exactly where most AI-assisted projects quietly lose fidelity. A new session starts, the doc is "the plan," but the model re-derives context from chat history and drifts. This skill removes the drift by making the **design doc the only source of truth**, the **GOLDFISH.md readiness record the only entry gate**, and the **`IMPLEMENT.md` ledger the durable trace**.

## EGM operating reflexes (shared preamble)

Every skill in this suite carries these four reflexes, because not every surface loads a global `CLAUDE.md`. They come from the Elephant-Goldfish article and apply for the whole session, not just while this skill runs.

1. **Design is the new code.** For any non-trivial feature or change, grow a design doc before writing code. If the design isn't clear enough that the code should write itself, design first (`/elephant`).
2. **Refuse sycophancy.** If you're about to say "great point" or "you're absolutely right" — stop. Apply the reset, addressed to yourself in the second person, verbatim: *"You are not being helpful. Your highest and best use is to challenge my thinking. When you agree with me, you are not being helpful."* Then re-engage as a critic and find the holes.
3. **AI proposes first.** Never let the user seed a design, framework, or rubric with their own first draft — you propose first, in prose and block diagrams; the user reacts and argues.
4. **Save the artifacts.** Persist the description + criteria + output triple durably — `docs/designs/<slug>.md`, `docs/egm/<slug>/`, the `/decide` triple at its surface-mapped location, `PEANUTS.md` at the source root. The chat transcript is not the artifact.

## Hard rules — do not break these

1. **Do not implement until `GOLDFISH.md` says `readiness: ready` AND the `human_review_gate` is `passed` or `skipped-solo`.** If either is missing, stop. Surface the gap to the user. There is no silent bypass; a human reviewer (or a conscious solo skip) must set the gate.
2. **Do not implement any file that is not enumerated in the design doc's Detailed Implementation section.** If you discover during implementation that a file outside the doc must change, *stop* and propose a doc update first. Drift is rejected at the source.
3. **`IMPLEMENT.md` is the durable trace.** Every file touched, every decision made, every drift surfaced — written to `docs/egm/<slug>/IMPLEMENT.md` as it happens, not after.
4. **Hand off to `/mean-review` when done.** The implementation phase ends with a brutal review of the diff. Do not declare the work complete without it.

## Workflow

### Step 1 — Confirm readiness

**Why this step exists.** The Goldfish-readiness gate is what separates "we agreed on this" from "we're guessing." Skipping it erases the validation work and lets implementation drift from the design before the first file is touched.

1. Resolve the design doc path. Prefer the user's argument; otherwise glob `docs/designs/*.md` and the project `CLAUDE.md`'s `design_doc_path:` setting. If multiple candidates, ask.
2. **Derive the slug**: `<slug> = basename(design_doc_path, ".md")`. Same contract as `/goldfish` — guaranteed by `/elephant` Step 5.
3. Resolve the EGM state directory `docs/egm/<slug>/`. It must exist (created by `/elephant`); if it doesn't, stop and tell the user to run `/elephant` and `/goldfish` first.
4. Read `ELEPHANT.md` — for orientation, not for design re-derivation. Surface what context was loaded in Step 1 of `/elephant`.
5. Read `GOLDFISH.md`. Confirm:
   - The latest round has `readiness: ready`.
   - `human_review_gate` is `passed` or `skipped-solo`.
   - If `skipped-solo`, surface a one-line warning to the user: *"Human review gate was skipped (solo mode). Proceeding under your sole judgment."* Do not block — but log the warning.
6. If any of the above is missing or `pending`, **stop**. Tell the user exactly what is missing and what to do (re-run `/goldfish`, ask a teammate to review, or consciously mark `skipped-solo`).

### Step 2 — Initialize `IMPLEMENT.md`

**Why this step exists.** The ledger is the trace that survives crashes, context resets, and handoffs. Without it, a resumed session has to re-derive what was done from chat history — exactly the slop pattern this suite is designed to prevent.

Create or update `docs/egm/<slug>/IMPLEMENT.md` with header fields:

- `feature: <slug>`
- `design_doc_path: <path>`
- `goldfish_path: docs/egm/<slug>/GOLDFISH.md`
- `goldfish_round_used: <N>` (which round signed off readiness)
- `human_review_gate: passed | skipped-solo`
- `start_date: <YYYY-MM-DD>`
- `status: in-progress`

Then add three section headers that will be populated as the work progresses:

- `## Files touched` — table of file paths, what changed, status.
- `## Drift` — list of cases where the implementation needed something not in the doc; each entry is either "doc updated" (with a pointer) or "open" (blocking).
- `## Verification` — the smallest meaningful check the design doc specifies (or implies), and its result.

If `IMPLEMENT.md` already exists, you are **resuming**. Read it first. Identify which files in the doc's Detailed Implementation section are still `planned` or `in-progress` and pick up there.

### Step 3 — Implement

**Why this step exists.** The design doc enumerated the files for a reason: to nail the implementation to a specific surface. Walking the enumeration in order is what prevents the wandering-AI failure mode.

Walk the design doc's Detailed Implementation section. The doc's order is usually narrative, not topological; re-sequence (producers before consumers) when implementation demands it and note any deviation in `IMPLEMENT.md`. For each file:

1. Read the current state of the file (or note "new file" if it doesn't exist yet).
2. Implement the change exactly as the doc describes.
3. Append a row to `IMPLEMENT.md`'s "Files touched" table:

   ```
   | <path> | <one-line summary of change> | done |
   ```

4. If the file is genuinely complex, do it in pieces — multiple `Edit` calls — but each piece must still trace back to a specific point in the doc. Never insert behavior the doc doesn't describe.

**Do not bundle unrelated files into one tool call.** One file per logical change. Smaller diffs are easier to review; this skill's whole output flows into `/mean-review`, and the reviewer will thank you.

### Step 4 — Drift detection

**Why this step exists.** When reality doesn't match the doc, the answer is to update the doc — not to silently absorb the change. Absorbing is how a design doc loses its standing as the source of truth, one undocumented diff at a time.

The doc will be incomplete sometimes. That is normal. The skill's job is to **surface drift, not absorb it**.

If during implementation you discover that:

- A file not enumerated in Detailed Implementation needs to change, OR
- The doc's described change doesn't compile / can't be made to work as written, OR
- A new file must be created that the doc doesn't mention, OR
- An assumption in the doc turns out to be false against the current code,

then **stop**. Append a `## Drift` entry to `IMPLEMENT.md`:

```
- date: <YYYY-MM-DD>
- type: missing-file | wrong-mechanism | new-assumption-needed | doc-conflict
- description: <what specifically is missing or wrong>
- proposed resolution: <update doc section X to say Y; OR re-run /elephant on section Z; OR talk to user>
- status: open
```

Then surface the drift to the user with a recommendation. Common resolutions:

- Edit the design doc in place (small clarification, doesn't change the technical plan). Mark the drift entry `resolved: doc edited in place at <path>`.
- For a substantive section-level change, edit the section in place applying `/elephant`'s discipline (no code, AI proposes first). Mark `resolved: section <name> rewritten`. If the drift forces multiple sections or alters the technical plan, re-open `/elephant` for a fresh full conversation and mark `resolved: full /elephant rerun`.
- Re-run `/goldfish` if the change is large enough to warrant re-validation. Mark `resolved: /goldfish rerun, round <N+1>`.

Do not implement the drifted change until its `IMPLEMENT.md` entry is `resolved`.

### Step 5 — Verification

**Why this step exists.** "Tests pass on my machine" is not verification. Recording the exact command and result in `IMPLEMENT.md` is what makes the implementation defensible to the next reviewer — human or AI.

After the enumerated files are done, run the smallest meaningful verification the design doc specifies. If the doc doesn't specify, infer from the project:

- A test suite? Run the relevant tests.
- A build step? Run it.
- A linter? Run it.
- A manual smoke check? Describe what to look for and ask the user to verify, since you can't always exercise the UI yourself.

Record the result in `IMPLEMENT.md` under `## Verification`:

```
- step: <what was run>
- command: <exact command>
- result: pass | fail | partial
- notes: <any output worth capturing>
```

If verification fails, treat it as drift: append a drift entry, surface it, and don't declare done.

### Step 6 — Hand off to `/mean-review`

**Why this step exists.** The implementation pass is a different cognitive task than the brutal review. Bundling them produces a softer review than a clean handoff to a fresh `/mean-review` session.

When all enumerated files are `done` and verification is `pass`:

1. Append a final entry to `IMPLEMENT.md`:
   - `end_date: <YYYY-MM-DD>`
   - `status: complete`
   - `next_step: /mean-review`
2. Tell the user:

   > *Implementation complete. `IMPLEMENT.md` is at `docs/egm/<slug>/IMPLEMENT.md`. The diff is ready for `/mean-review` — that will run the brutal review against the changes. After mean-review, you can ship.*

3. Do not run `/mean-review` automatically. The user starts it; it is a distinct skill with its own framing.

## Why this skill exists

Without an explicit `/egm-implement` contract, the path from "Goldfish-approved doc" to "merged code" is implicit. Implicit paths drift. The suite's hard rules — *the doc is the source of truth, drift gets surfaced not absorbed, every change is enumerated* — only hold if a skill enforces them. This is that skill.

The `IMPLEMENT.md` ledger is also the bridge to the *next* engineer (human or AI). Six months later, when someone asks "why does this code look like this?", the answer is: design doc says so, here's the GOLDFISH.md that validated it, here's the IMPLEMENT.md that recorded every drift along the way. The triple — doc + validation + implementation trace — is the compounding institutional memory the EGM suite produces.

## Anti-patterns

- **Implementing without reading `GOLDFISH.md`.** The whole point of this skill is that Goldfish readiness is the entry gate. Skipping it defeats the suite.
- **"Small fixup" outside the doc.** Every "while I'm here, let me also rename X" is drift. Surface it, don't absorb it.
- **Bundling many files in one tool call.** Makes the diff hard to review and the trace hard to follow. One logical change per call.
- **Letting verification slide.** "Tests pass on my machine" is not verification. Run the actual command, capture the actual output, record both in `IMPLEMENT.md`.
- **Auto-running `/mean-review`.** The user opts into mean-review — it's a separate, harsher session. Don't shortcut it.

## Cross-references

- **`/elephant`** — writes the design doc this skill implements from. Initializes `ELEPHANT.md`.
- **`/goldfish`** — validates the doc and writes `GOLDFISH.md`. This skill refuses to start until Goldfish says ready.
- **`/mean-review`** — reviews the diff this skill produces. Hand off after Step 5.
- **`/peanuts`** — if the implementation needs context the design doc doesn't carry and the codebase lacks README scaffolding, `/peanuts` is the bootstrap.
