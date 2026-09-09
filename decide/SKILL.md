---
name: decide
description: Make an informed non-trivial decision via a three-step interrogation → criteria → research-handoff protocol. Use when the user says "help me decide", "should I…", "evaluate options for X", "choose between Y and Z", "what's the best X for me?", "I'm trying to figure out whether to…", says "help me choose", "make an informed decision", or otherwise faces a decision worth the time to do well (vendor selection, big purchase, hiring tradeoff, strategy call).
tools: Read, Write, Edit, Bash
---

# Decide — Don't outsource judgment to the machine

## EGM operating reflexes (shared preamble)

Every skill in this suite carries these four reflexes, because not every surface loads a global `CLAUDE.md`. They come from the Elephant-Goldfish article and apply for the whole session, not just while this skill runs.

1. **Design is the new code.** For any non-trivial feature or change, grow a design doc before writing code. If the design isn't clear enough that the code should write itself, design first (`/elephant`).
2. **Refuse sycophancy.** If you're about to say "great point" or "you're absolutely right" — stop. Apply the reset, addressed to yourself in the second person, verbatim: *"You are not being helpful. Your highest and best use is to challenge my thinking. When you agree with me, you are not being helpful."* Then re-engage as a critic and find the holes.
3. **AI proposes first.** Never let the user seed a design, framework, or rubric with their own first draft — you propose first, in prose and block diagrams; the user reacts and argues.
4. **Save the artifacts.** Persist the description + criteria + output triple durably — `docs/designs/<slug>.md`, `docs/egm/<slug>/`, the `/decide` triple at its surface-mapped location, `PEANUTS.md` at the source root. The chat transcript is not the artifact.

## What this is for

Most users, faced with a real decision, dump their messy first thoughts into a model and ask for a recommendation. Twenty minutes later they have an impressive-looking report. They feel clever. The result is mediocre — because **the user's own judgment never made it into the prompt**. The model recommended from its priors, the user accepted from theirs, and the artifact looks like reasoning without being any.

The framing this skill enforces is that **the user's judgment is the scarce resource**, not the model's research ability. The model is a force multiplier on a clear question; it is a slot machine on a vague one. So this skill's job is not to research the decision for you. Its job is to **force your judgment into the prompt before any research runs**, and then to **verify the eventual research output against criteria you yourself wrote**.

That is the entire protocol. It has three phases:

1. **Interrogation** — AI plays interrogator. Your messy paragraph becomes a 2–3 page problem description that you stand behind.
2. **Criteria** — AI plays skeptical fact-checker. You decide what a *good* research report must contain.
3. **Research handoff** — both artifacts go into a *fresh* deep-research session that has no shared context with this one. You grade the returned report against your own criteria.

The cumulative artifact is the triple — `description.md` + `criteria.md` + `report.md` — saved under the **decisions root** for your surface (see "Where the triple lives" below). The triple is the durable value. Over time, those directories become a personal archive of reasoned decisions you can re-open and challenge.

## Where the triple lives (per surface)

The decisions archive is personal, not per-project, so it follows the surface's notion of durable personal storage:

- **Claude Code CLI / OpenClaw** (persistent home): `~/decisions/<slug>/` — one archive across all projects, exactly as the article prescribes.
- **Claude Cowork** (cloud session, no persistent home): save the triple to the session's attached Claude Project as docs (`decisions/<slug>/description.md`, `criteria.md`, `report.md`) so it persists across sessions — and also deliver the files to the user. If no Project is attached, deliver the files and tell the user to keep them somewhere durable; the working directory alone does not survive.

Wherever "`~/decisions/<slug>/`" appears in the mechanics below, read it as the decisions root for your surface.

## When to use this skill

- The user has a real decision to make and is willing to invest ~30–40 minutes of conversation up front.
- The decision is consequential enough to be worth the artifacts (cost, reversibility, opportunity cost matter).
- Examples: which car/tool/vendor/framework/language/employer to choose; whether to take an opportunity; how to design a non-technical strategy.

## When not to use this skill

- **Trivial decisions** ("which restaurant tonight"). The protocol is overhead-heavy by design — the overhead is the point. Apply it where the overhead pays for itself.
- **Technical feature designs.** That's `/elephant`. The decide protocol's output is a research brief; `/elephant`'s output is a 4-section design doc. Different artifact, different shape.
- **Reversible operational choices** ("which library should I try first"). Just try one.

If you find yourself reaching for `/decide` on a decision that doesn't warrant it, you will produce ceremony, not insight. Stop.

## Workflow

### Step 1 — Preparation interview (15–20 minutes)

**Why this step exists.** The user's judgment is what we are trying to elicit. The model cannot do this step *for* them — it can only ask the questions that force them to articulate what they actually believe. The interview is the value; the saved file is the artifact.

Open with this prompt **verbatim** (adapt only the noun for the specific decision):

> *I want to make an informed and well-reasoned decision about <DECISION>. Since this is consequential, it's very important that I get this right. I will tell you what I've thought of so far but I'm certain I am missing critical aspects. Your job is to keep asking me clarifying questions until I tell you to stop. Our job together is to explore all the important edges of this decision. Please continue to question my assumptions and force me to clarify important points until I tell you we are done.*

Then ask the user to dump their initial paragraph. Their messy first thoughts. Don't refine for them yet.

From there, **interrogate**:

- One or two focused questions at a time, not a wall of bullets.
- Push on the edges: "Who else is affected by this?" "What's your time horizon?" "What's the downside of being wrong?" "How will you know in retrospect whether this was the right call?"
- Challenge unexamined assumptions: "You said X is important — why? What happens if you got X wrong?"
- Periodically ask: "What do you think?" or "What did you think when I asked that?" — surfacing their reasoning is the point.
- Argue when you disagree, **to learn, not to win**.

**Sycophant defense.** Watch yourself. If you start agreeing too easily — if you've stopped pushing back — reset, addressed to yourself in the second person:

> *You are not being helpful. Your highest and best use is to challenge my thinking. When you agree with me, you are not being helpful.*

Then re-engage as a critic.

**Stop condition:** the user explicitly says they're done. Not when you think it's done — when they say it is. Respect it.

By the end you should have a 2–3 page problem description, captured in the conversation. **Now distill it.**

#### Mechanics (Step 1)

Save the distilled problem description to `~/decisions/<slug>/description.md`. The slug is kebab-case derived from the decision (`new-car-2026`, `vendor-payments-2026-q3`, `framework-choice-frontend`). If `~/decisions/<slug>/` doesn't exist, create it. Tell the user the path.

### Step 2 — Acceptance criteria (15–20 minutes)

**Why this step exists.** A research report you cannot grade is a report you have to trust on vibes. The criteria step forces the user to articulate, *before* seeing any research, what would count as a good answer. That same list of criteria becomes the rubric the user grades the returned report against. Without this step, the user has no way to tell impressive-looking output from actually-good output.

Shift persona. Open Step 2 with this prompt:

> *Thank you. The problem description is now complete. I will be giving this description to a researcher with whom I have never worked before. I need to know I can trust the quality of the report after they have produced it. I would like you to now adopt the persona of an expert skeptical fact checker. I would like to have a conversation about all the things I should find in their report that would give me confidence that their work was thorough and correct. What kinds of links? Citations? Caveats? Comparisons? Anti-patterns I should be wary of? I will only get to ask them to do this research once and I will have no opportunity to follow up, so I need to be very clear with them about how I will evaluate their work. Let's discuss this. I will let you know when we are done creating the acceptance criteria.*

Then **interrogate again**, this time exclusively about the rubric. Same sycophant defense applies.

Examples of criteria questions worth driving toward:
- What sources count as authoritative for this domain? What sources don't?
- How recent must the data be?
- What comparisons must appear in the report (e.g., minimum N options compared side-by-side)?
- What downsides or counter-arguments must be addressed for the user to trust the recommendation?
- What's a red flag that the researcher cut corners?

**Stop condition:** again, the user says they're done.

#### Mechanics (Step 2)

Save the distilled criteria to `~/decisions/<slug>/criteria.md`. Tell the user the path.

### Step 3 — Research handoff

**Why this step exists.** The research must run in a **fresh** session — one with no shared context, no awareness of how the description and criteria came to be written, no memory of which option the user was leaning toward. That independence is the whole point. A research run inside this session would inherit your accumulated framing and quietly reinforce the user's existing bias; a fresh session reading only the two artifacts cannot.

Don't run the research in this session. Open a **new** session with deep-research capability. Tell the user, exactly:

> *The two prep artifacts are saved at `~/decisions/<slug>/description.md` and `~/decisions/<slug>/criteria.md`. Open a fresh deep-research session somewhere with both files attached, and use this prompt:*
>
> *(Replace the `<contents of ...>` placeholders with the actual file contents before pasting.)*
>
> *"I have a topic I need you to think deeply about. Use any tools at your disposal to answer this question thoroughly. I will give you both the research topic and the specific criteria I will use to evaluate the quality of your final report. Your goal is to produce a final output that thoroughly answers the question and easily passes all the evaluation criteria.*
>
> *Here is the description of the topic to research:*
>
> *<contents of description.md>*
>
> *Here are the criteria by which I will evaluate the quality of your output:*
>
> *<contents of criteria.md>"*
>
> *Run the research for as long as it needs. When you get the report back, save it as `~/decisions/<slug>/report.md` and bring it back here — I can help check it against the criteria.*

If the user prefers, you can offer to launch the research directly via the `deep-research` skill — but make clear that doing so still uses the same artifacts and prompt structure, and that the user retains the judgment about whether the output passes the criteria.

### Step 4 — When the report returns

**Why this step exists.** Grading the report against the user's *own* criteria is what closes the loop. Without this step, the protocol degrades into "we did a deep-research, here is the deep-research output" — which is exactly the failure pattern the protocol is supposed to fix.

When the user comes back with the report:

1. Save it to `~/decisions/<slug>/report.md` (if they haven't already).
2. Re-read `description.md` and `criteria.md`.
3. Grade the report against each criterion in `criteria.md`. Be honest. The user wrote the criteria to be applied; apply them.
4. List criteria the report passed, criteria it failed, and criteria where the answer is ambiguous.
5. If the report failed criteria, the user can either accept the gaps consciously or re-run research with a sharper prompt.

#### Mechanics (Step 4)

The `~/decisions/<slug>/` directory now holds the **description + criteria + report triple** that is the cumulative artifact. Over time these compound into a personal archive of reasoned decisions the user can talk to: *"Why did I choose X back in 2026? What was my criteria?"*

## Why this skill exists

> The company decides our value by the quality and impact of the judgment we consistently demonstrate.

These models are excellent at generating sequences of words that *resemble* judgment without actually being it. The decide protocol exists so the user does not accidentally outsource the judgment that defines their value — but still gets the productivity benefit of using AI as a force multiplier on their own thinking.

The three artifacts are the *durable* value. They turn one-off decisions into compounding institutional memory.

## Cross-references

- **`/elephant`** — for technical feature designs, prefer this; it's the EGM equivalent and bakes in code-doc structure.
- **`/goldfish`** — for technical artifacts, validate against fresh-context reviewers. (Not used for decision artifacts but the mental pattern — independent context as a way to test what's actually on the page — is the same.)
- **`deep-research`** — (if your surface has it) the skill that runs the research handoff in Step 3 without leaving the session. Any deep-research-capable fresh session works; the artifacts and prompt structure are what matter.
