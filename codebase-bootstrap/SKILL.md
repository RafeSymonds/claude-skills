---
name: codebase-bootstrap
description: Give AI cheap, reliable context on a large or unfamiliar codebase by recursively generating a hierarchy of README.md files (the "peanuts and hay" method), leaf-to-root. Use when onboarding to a big repo, when the AI keeps hallucinating about the code, or to make human onboarding fast. sizeof(docs) << sizeof(code) — plain-English summaries are far cheaper and more reliable context than raw source.
---

# codebase-bootstrap (peanuts & hay)

Feeding an AI the entire source tree makes it choke — it loses context and hallucinates. Instead feed it **peanuts and hay**: small, compressed, high-nutrition bites of context. Those bites are `README.md` files, harvested through recursive summarization. The result is a context hierarchy you can load at the root to make the AI (and new humans) understand the system almost instantly, using a fraction of the context window that reading source would.

This is a guided, incremental process. Verify as you go — don't trust generated summaries blindly.

## Process: harvest leaf-to-root

1. **Start at the leaves** of the source tree. (On a team, divide directories among people.)
2. **Generate the peanuts.** Point the AI at one leaf directory:
   > Read the files in this directory and produce a README.md that (a) explains the purpose of this directory and the files in it, and (b) enumerates each file with a short description of its function.
3. **Human verification.** At the leaves the AI has only code to go on and will be **~50% wrong.** The owner spends 5–10 minutes fixing each README. This step is not optional — wrong leaves poison everything above them.
4. **Roll up the hay.** Move up one level and use the child summaries plus this level's own code:
   > Read all README.md files in the subdirectories below this one, then read the code in just this directory, and create a README.md that (a) explains the purpose of this directory and its files, and (b) enumerates each file with a short description of its function.
5. **Continue upward**, level by level, until you reach the project root.

When done, open a fresh session at the root, feed it **just the READMEs**, and it will reliably pick out the major subsystems and design patterns — a huge boost before making changes.

## How long do the READMEs need to live?

Only until your design docs reference (and lightly explain) every code file — i.e. 100% file coverage across docs. After that you can delete the READMEs or keep them; your call. A greenfield project that's rigorous with design docs (see **/design-doc**) never needs them at all.

## Bonus: instant human onboarding

Once the tree is documented:

1. Load the full README hierarchy + existing design docs into a NotebookLM-style notebook.
2. In the system instructions, name the part of the system the new person will focus on.
3. Hand it over. Their first job: use the notebook to learn enough to write a solid design doc (via **/design-doc**) for their first feature.
4. When their doc passes the Goldfish test, they know enough to contribute productively — no weeks of shadowing or reverse-engineering legacy code.

The same trick works for non-engineers (PMs, etc.) who want a feature: give them the notebook, have them draft the design doc, then review it like any other.

## Where things are saved

READMEs are written **in place**, one per directory, inside the repo being documented. Design docs produced afterward go in `docs/` per **/design-doc**.
