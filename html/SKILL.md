---
name: html
description: Produce a self-contained HTML artifact instead of a Markdown file. Use for implementation plans, specs, design explorations, code reviews / PR write-ups, research reports, technical explainers, and custom throwaway editors / two-way tools — anything where richer information density (tables, SVG diagrams, code with syntax, side-by-side comparisons, interactive widgets) beats a flat Markdown doc. Also use when the user says "make an HTML artifact", "HTML file", "HTML report", or invokes /html.
argument-hint: [what the artifact should contain]
---

# html

Output a single self-contained `.html` file — richer than Markdown, easier to share, easier to read. The point isn't pretty for its own sake; it's that you can pack in tables, SVG diagrams, real code blocks, side-by-side comparisons, and copy-to-clipboard widgets that Markdown can't carry.

## When to use this vs. Markdown

Use HTML for:
- Implementation plans / specs with diagrams, mockups, or annotated code
- Code reviews and PR write-ups (rendered diffs, severity-coded findings)
- Design explorations (side-by-side variants in one file)
- Research, status reports, and technical explainers (SVG diagrams, navigable structure)
- Throwaway editors / interactive tools where the artifact exports a JSON/Markdown/prompt blob back

Stick with Markdown for:
- Files the user (or other tools) will edit by hand or diff in git
- READMEs and other repo-resident docs
- Short snippets, quick answers, single-paragraph notes

If unsure for a borderline case, ask once.

## File handling

1. **Location.** Default to `~/html-artifacts/YYYY-MM-DD-<slug>.html` (create the directory if missing). If the user is clearly working in a project and asks for the artifact "in the project", use `./artifacts/<slug>.html` instead. If they give an explicit path, use it verbatim.
2. **Self-contained.** Inline all CSS in `<style>`, inline JS in `<script>`. Prefer SVG over image files. If you must use external assets, use stable CDN URLs (e.g., Google Fonts) — never localhost or relative paths to files that won't ship with the HTML.
3. **After writing**, tell the user the absolute path and offer to open it: `open <path>` on macOS.
4. **Doctype + viewport.** Always start with `<!doctype html>` and include `<meta name="viewport" content="width=device-width, initial-scale=1">`.

## Design taste (document-flavored)

This skill produces **documents** — readable, calm, information-dense but not noisy. For *bold, distinctive UI* (landing pages, product mockups, brand work), invoke the `frontend-design` skill instead; the taste below is wrong for that use case.

**Typography.** Use a real text face, not Inter or Arial. Reasonable picks:
- Body in a refined sans like `ui-sans-serif, system-ui` paired with a tasteful display font from Google Fonts (e.g., `Fraunces`, `Instrument Serif`, `Newsreader`) for headings.
- Or, for long-form reading: a serif body (`Charter`, `Iowan Old Style`, fallback `Georgia, serif`) with a clean sans for UI chrome.
- Line height ~1.6 for body. Max reading width ~68–72ch.

**Color.** Neutral surface, near-black text, one accent. Pick a palette and commit. Skip gradients on document content. Always implement dark mode via `prefers-color-scheme` using CSS custom properties — set `:root` light values and `@media (prefers-color-scheme: dark) { :root { ... } }` overrides.

**Spacing.** Generous. Sections get real breathing room. Don't pack content edge-to-edge — use a centered content column (`max-width: 72ch` for prose, wider for grids/diagrams) with comfortable side padding.

**Code blocks.** Monospace (`ui-monospace, SFMono-Regular, Menlo, monospace`), subtle background tint (not stark gray), 0.95em or smaller, line numbers only when annotating specific lines.

**Tables.** Minimal borders — usually a thin rule above the header row and below the last row, optional thin row dividers. No vertical lines. Tabular numerals (`font-variant-numeric: tabular-nums`).

**What to avoid.** Centered hero sections with three feature cards. Purple-to-blue gradients. Drop shadows on every box. Emoji as decoration. Lorem ipsum — use the real content. Generic "card" components stacked vertically for everything.

## Use-case playbooks

Each playbook is a starting point — adapt to the specific request.

### Plan / spec
- Top: one-paragraph problem statement and a TL;DR of the proposed approach.
- Sticky table of contents on the left or top (use `position: sticky`).
- Sections: Context → Approach → Data flow (SVG diagram) → Key code snippets (annotated) → Open questions → Rollout / testing plan.
- Inline mockups as `<svg>` or as small annotated screenshots.
- Use `<details>` for "alternatives considered" so they don't dominate the page.

### Code review / PR write-up
- Header with PR title, branch, and a one-paragraph summary.
- Findings table near the top: severity (color-coded — neutral, info, warn, block), file:line, one-line description, linking to the relevant section below.
- For each finding: render the diff inline (red/green background tints, monospace), with margin annotations explaining the concern.
- Final section: "What I checked" and "What I didn't check."

### Design exploration
- Grid of N variants in one file, each labeled with the tradeoff it's making.
- Each variant in its own bordered region so they read as distinct.
- Brief paragraph under each: "this variant prioritizes X at the cost of Y."
- Consider a responsive iframe-like preview for HTML mockups.

### Research / explainer / report
- Cover region with title, date, and one-sentence thesis.
- Generous use of SVG diagrams — flowcharts, state machines, sequence diagrams (hand-rolled SVG, no Mermaid runtime dependency).
- Annotated code excerpts where the explanation lives in the right margin alongside the code.
- Closing "Gotchas" or "What's still unclear" section.

### Custom editor / two-way tool
- The interactive thing on top (drag-and-drop columns, form, slider, color picker, whatever the task needs).
- **Always** end with an export: a button that copies the current state to the clipboard as JSON, Markdown, or a ready-to-paste prompt. Without this, the artifact is a dead-end.
- Persist state to `localStorage` so a page reload doesn't lose work.
- Keep the JS small and dependency-free — vanilla JS in a `<script>` tag.

## Interaction patterns (vanilla, no deps)

**Copy-to-clipboard button** — works without any library:

```html
<button onclick="navigator.clipboard.writeText(this.dataset.payload).then(()=>{this.textContent='Copied'})"
        data-payload="text to copy">Copy</button>
```

For dynamic content (export-as-JSON from current UI state), generate the payload in JS at click time rather than stashing it in the dataset.

**Collapsible** — use native `<details><summary>`. Style the summary; no JS needed.

**Tabs (no JS)** — radio inputs hidden visually, labels styled as tab handles, sibling combinators show the matching panel. Falls back gracefully.

**Sticky TOC** — `position: sticky; top: 1rem;` on the nav column inside a CSS grid layout. Highlight the active section with `IntersectionObserver` if the artifact is long enough to need it.

**Side-by-side comparison** — `display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1.5rem;` is usually the right default.

**SVG diagrams** — write SVG by hand for clarity. Use `<text>` for labels, `<path>` with `marker-end` for arrows. Keep stroke widths consistent (e.g., 1.5). Don't reach for a JS diagramming library unless the diagram is genuinely dynamic.

## Output checklist

Before reporting the artifact done:
- [ ] File saved to a sensible absolute path; path printed for the user.
- [ ] Self-contained — no broken local references, no localhost URLs.
- [ ] Dark mode works (toggle your OS theme or check the media query).
- [ ] Mobile-readable — at least horizontal scroll doesn't appear on the body.
- [ ] If it's a two-way tool, the export button actually produces useful output.
- [ ] Offer to open it: "Open with: `open <path>`".

$ARGUMENTS
