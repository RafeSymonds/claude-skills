---
name: html-to-pdf
description: Render HTML to a PDF (and optional PNG preview) using the local agentic html_to_pdf tool. Use whenever the user asks to generate, create, build, export, or save a PDF — from inline HTML, a local .html file, or a URL. Also use for slide decks, reports, invoices, resumes, or any "make me a PDF of X" request.
allowed-tools: Bash Write Read
argument-hint: [description of the pdf to generate]
---

# html-to-pdf

Wraps `htmlToPdfTool` from `/Users/rafe/other/lobs/agentic/packages/tools/dist/html-to-pdf.js` via a Node bridge at `~/.claude/skills/html-to-pdf/render.mjs`.

## Workflow

1. **Author the HTML.** Write the HTML to a file (e.g. `/tmp/doc.html`) using the Write tool. Inline all CSS in a `<style>` block — the renderer is headless Chromium, so any modern CSS works (flex, grid, custom fonts via `@import`, SVG, etc.).
2. **Pick a preset** based on what's being made:
   - `document` (default) — Letter, 0.75in margins, serif body. Reports, memos, letters.
   - `a4` / `letter` / `legal` — same defaults but explicit paper size.
   - `letter-landscape` / `a4-landscape` — landscape orientations.
   - `report` — paged report styling with cover-friendly defaults.
   - `deck` / `slides-16x9` / `slides-4x3` — slide-deck dimensions, no margins. Use `<section class="slide">` per slide.
   - `minimal` — light styling, lets your CSS dominate.
   - `none` — zero injected CSS. Use when you want full control.
3. **Write a params JSON file** (e.g. `/tmp/params.json`) describing the render:
   ```json
   {
     "path": "/tmp/doc.html",
     "output_path": "/tmp/doc.pdf",
     "preset": "document",
     "preview_image": true,
     "header_footer": "page-numbers"
   }
   ```
   Use absolute paths for `output_path` and (if used) `path`/`preview_image` so the result lands where the user expects.

   Source field — pick exactly one: `html` (inline string), `path` (local .html file), `url` (http/https).

   Other useful fields: `paper` ("Letter" | "A4" | "13.333in x 7.5in"), `margins` ("0.5in" or "1in 0.5in"), `landscape`, `theme` ("document" | "deck" | "minimal" | "none"), `page_ranges` ("1-3,7"), `custom_header_html`, `custom_footer_html`, `wait_for` (ms or "load"|"networkidle"), `scale`, `emulate_screen`.

4. **Run the bridge:**
   ```bash
   node ~/.claude/skills/html-to-pdf/render.mjs pdf /tmp/params.json
   ```
   For a dry-run (PNG preview + diagnostics only, no PDF) use `check` instead of `pdf`.

5. **Read the diagnostics** in the output. The tool reports page count, overflow warnings, broken images, and design lints. If it warns about overflow or broken images, fix the HTML and re-run.

## Notes

- Playwright + Chromium are already installed in the agentic repo's `node_modules`. The bridge imports the built `dist/` so no rebuild is needed.
- For iterative layout work, run `check` first with `preview_image: true` — it skips the PDF write and is faster.
- If the user provides a target output path, use it verbatim. Otherwise default to the current working directory.
- Don't pass huge inline HTML through the JSON file when a `path:` source works — write the HTML to its own file.

$ARGUMENTS
