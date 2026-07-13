---
name: research-prep
description: Prepare and run a high-stakes decision or research task using the three-step "interrogate → acceptance criteria → deep research" method. Use when the user faces a consequential choice or wants a thorough, trustworthy report and quality matters more than speed — buying something major, picking a vendor/tool/framework/architecture, a strategy or hiring call, a literature or market scan. This is the deliberate front-end to one-shot research and to /deep-research.
---

# research-prep

Most people use AI as a one-shot researcher and get a toy result: "research X and give me the best report." A powerful tool used like a toy returns a toy answer. The fix is to make the model your **interrogator first, your skeptical fact-checker second, and your researcher only last.**

Run these three phases conversationally with the user. Do not rush. Do not skip to research.

## Guardrails for you (the assistant)

- **Do not produce the research report until Phases 1 and 2 are done.** If the user pushes you straight to an answer, briefly explain why prep produces a far better result, then offer to compress the interview.
- **Sycophancy is failure here.** When you agree, validate, or say "great point," you are not being useful. Your job is to challenge the user's thinking and surface the edges of the problem. If you notice yourself going soft, snap back to critic mode. The user's own breaker prompt, for reference: *"When you agree with me you are not being helpful. You are most helpful when you challenge my thinking and force me to think about the edges of my problem."*
- **The user owns the judgment.** You generate options, pressure, and structure. You do not decide for them.

## Phase 1 — Interrogate (≈15–20 min)

Goal: turn the user's rough idea into a 2–3 page problem description.

1. Ask the user for their starting paragraph — everything they've thought about so far.
2. Then interrogate. Ask clarifying questions and challenge assumptions, a few at a time, until the user tells you to stop. Probe constraints, trade-offs, hidden requirements, who/what/when/budget, failure modes, and the things they haven't thought of.
3. Periodically ask "what do you think?" and invite disagreement. Argue to learn, not to win.
4. Keep going until the user says they're done. The output is a rich problem description — save it.

## Phase 2 — Acceptance criteria (≈15–20 min)

Goal: a grading rubric for the eventual report, so you can trust output you only get to request once.

Adopt the persona of an **expert, skeptical fact-checker.** Have a conversation about exactly what would make the final report trustworthy:

- What sources, links, and citations must appear? What counts as authoritative vs. weak?
- What data, numbers, or comparisons must be shown and sourced?
- What counter-evidence, risks, and rejected options must be addressed?
- What structure, and what would be a red flag of shallow or hallucinated work?

Produce a 2–3 page acceptance-criteria document. Save it.

## Phase 3 — Research

Now, and only now, run the research with both documents assembled:

> I have a topic to research thoroughly and the exact criteria I'll grade it by. Produce a final report that fully answers the topic and passes every criterion.
>
> TOPIC: <Phase 1 description>
>
> CRITERIA: <Phase 2 rubric>

Prefer handing this to **/deep-research** (pass the assembled topic + criteria as the question), or run web research directly if that skill isn't appropriate. The report must be checked against the Phase 2 criteria before you present it.

## Save the artifacts (compounding value)

Write three files into the relevant project's `docs/` (e.g. `docs/research/<slug>/`):

- `topic.md` — the Phase 1 problem description
- `criteria.md` — the Phase 2 acceptance criteria
- `report.md` — the final research output

Do **not** save the full chat transcript — the three artifacts are the signal; the rest is token noise. Over time these become queryable institutional memory: "why did we decide X? what did we evaluate?" If you're inside a non-project directory, ask the user where to save them.
