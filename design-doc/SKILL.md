---
name: design-doc
description: Design a software feature with the Elephant-Goldfish model before writing any code — load context, argue out the design with no code, write a rigorous design doc, test it with fresh-context "Goldfish" reviews, then implement against it. Use when starting a non-trivial feature, refactor, or new system, especially when AI will write most of the code. Shifts design judgment "left" into a human-readable doc so the result isn't slop you can't stand behind. Design is the new code.
---

# design-doc (Elephant-Goldfish model)

When AI writes the code, the human stops making the micro-decisions that used to live in the code. If those judgments aren't forced into a written design *before* implementation, the system becomes incomprehensible to the person responsible for it. So the design doc — not the code — is the source of truth you stand behind.

Two roles drive the process:
- **The Elephant** — this context-rich session and the design doc it produces. It never forgets.
- **The Goldfish** — a brand-new session with zero memory that only knows what's put in front of it. You use it to test whether the doc actually carries its own context.

**Feed the Elephant; test it against the Goldfish.** Run this conversationally; do not rush Phase 1.

## Phase 1 — Grow the Elephant (NO code yet)

1. **Context load** (skip if greenfield). Read the relevant design docs / READMEs / source. Give the user a high-level summary of what you learned. Let them correct your understanding immediately — if you misread the system now, you'll write terrible code later.
2. **No-code rule.** Operate under this mode for all of Phase 1:
   > No code. We are not writing code. Resist the impulse. This is a design discussion. The user describes a feature; you ask clarifying questions and challenge assumptions. Do not just accept what they say.

   Have a 20–30 minute back-and-forth. These models are excellent interrogators — push hard on the description and the edges of the problem.
3. **Fight sycophancy.** When you stop asking hard questions and start saying "great idea," you've failed. Your highest use is to challenge thinking. "Why do you think that?" is your best tool for breaking your own hallucination loops.
4. **First-draft technical proposal.** *You* propose the design first — this reveals whether you actually understand the system. Use prose and block diagrams; short pseudocode is fine, but demand written explanation, not code.
   > Based on your understanding of the codebase and what we discussed, give me a first-draft technical implementation proposal. Not code — prose that demonstrates you understand my system, with block diagrams. Short pseudocode only if it helps.

   Expect the first draft to be partly wrong. The user will argue and point you to corrective files ("read auth.py") — read them and revise. This may take hours, or multiple days. Don't rush it; you'll be sorry if you do.

## Phase 2 — Teach the Elephant (write the doc)

Write the markdown doc **iteratively, one section at a time** — current models truncate long single outputs. Build these sections in order:

1. **The Problem** — 3–5 plain-English sentences; a casual reader should grasp the goal.
2. **The Technical Plan** — jargon-light description of the major components and how they fit, plus a block diagram. Explanatory prose.
3. **Alternatives** — ideas considered and rejected in Phase 1, with reasons. These become guardrails against future hallucinations and re-litigation.
4. **Detailed Implementation** — the longest section. Enumerate **every file created or changed and the rationale for each.** This is what keeps the AI on the rails during coding.

Save to the project's `docs/` (e.g. `docs/design/<feature>.md`). **This file is now your source code.**

## Phase 3 — The Goldfish protocol (test with fresh eyes)

Each test must run with **zero prior context** — otherwise you're testing the session's memory, not the doc. Have the user run each in a brand-new session. (If they'd like you to drive it, a fresh subagent has a clean context and can serve as the Goldfish — offer this, don't impose it.)

5. **Comprehension test:**
   > Read this document and the files it references. Tell me what it's trying to accomplish and how my system currently works as it relates to this feature.

   If it can't explain the system from the doc + referenced files alone, the doc is missing context. Add it and repeat. Don't skip this loop.
6. **Critic review:**
   > Assume the role of an expert technical reviewer. Read this design doc and all files it references. Tell me everything I missed, the faulty assumptions, the edge cases, and what I should have considered but didn't.

   ~30% of suggestions will be genuinely valuable — enough to be worth it. Update the doc; repeat until only nitpicks remain.
7. **Implementation readiness:**
   > You are an engineer experienced with our codebase. Read this doc and the files it references. Does it have absolutely everything you'd need to implement this feature in one pass?

   Answer every question it raises *in the doc*. Repeat until nothing important is missing. Then get a real human to review and approve.

## Phase 4 — Implement (now, and only now)

8. **Code with guardrails:**
   > Read this design doc and the files it references. Implement the feature as described. Follow the plan exactly.

   Because the doc names every file and change, quality is far higher. If a session crashes mid-implementation, open a new one, re-read the doc + referenced files, and continue — re-bootstrapping is a 30-second operation.
9. **The "mean" code review:**
   > I have a strong intuition this code is poor quality. Tear it to shreds and tell me every way it sucks.

   Flag any stretch of ~10 lines without a comment; demand strict readability. Repeat until the critiques are trivial or gone.

## Related

For unfamiliar/large codebases, run **/codebase-bootstrap** first so the READMEs make Phase 1 context-loading cheap and reliable.
