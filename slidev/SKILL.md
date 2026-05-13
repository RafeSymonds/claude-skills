---
name: slidev
description: Author developer-friendly slide decks with Slidev (https://sli.dev) — Markdown + Vue + Vite — and export to PDF, PPTX, PNG, or a deployable SPA. Use whenever the user wants to build slides from Markdown, generate a PowerPoint deck from notes/outline, or convert an existing Slidev `slides.md` to another format.
allowed-tools: Bash Write Read Edit
argument-hint: [topic or path to source .md / outline]
---

# slidev

[Slidev](https://sli.dev) is a presentation tool for developers: write slides in Markdown, render with Vue + Vite, export with Playwright. Compared to Marp, it has better code blocks (Shiki, line-by-line animation, Magic Move), real Vue components in slides, inline Iconify icons, UnoCSS utility classes, a presenter mode, and a hot-reload dev server.

Outputs:
- **PDF** — `slidev export slides.md` (default)
- **PPTX** (PowerPoint) — `slidev export slides.md --format pptx`
- **PNG** — `slidev export slides.md --format png` (one PNG per slide)
- **Markdown** — `slidev export slides.md --format md`
- **SPA** (static site) — `slidev build slides.md` → `dist/`

Export uses headless Chromium via Playwright.

## Workflow

### 1. Verify slidev is callable
`slidev` is installed globally at `/opt/homebrew/bin/slidev` (installed via `npm install -g @slidev/cli`). Just call `slidev ...` directly. If `slidev` is somehow missing, fall back to `npx --yes @slidev/cli@latest ...` or reinstall with `npm install -g @slidev/cli`.

The first export will download a Playwright Chromium build, which takes a minute. If export complains about a missing browser, run `npx playwright install chromium`.

For a real long-lived project the user can `npm init slidev@latest` to scaffold a full project, but for ad-hoc decks a bare `slides.md` is enough — `slidev slides.md` will work standalone.

### 2. Author the deck (`slides.md`)
Slides are separated by `---` lines. The block at the very top of the file (before the first slide content) is the **headmatter** — global config. Use the Write tool, not echo/heredoc.

Minimal skeleton:

```markdown
---
theme: default
title: My Deck
info: |
  Quick overview of the topic.
class: text-center
highlighter: shiki
colorSchema: dark
fonts:
  sans: 'Inter'
  mono: 'JetBrains Mono'
transition: slide-left
mdc: true
---

# Title Slide
Subtitle line

---

## Agenda

<Toc maxDepth="1" />

---
layout: center
class: text-white
background: '#0b1020'
---

# A spotlighted slide

Only this slide gets the dark background and centered layout.

<!--
Speaker notes go in an HTML comment at the END of the slide.
They show up in presenter mode and in PPTX notes.
-->
```

Per-slide frontmatter goes between two `---` lines immediately after a slide separator. Use it for `layout:`, `background:`, `class:`, `transition:`, etc.

### 3. Verify visually (do not skip — this is what stops broken decks shipping)

Slidev renders Markdown through Vue + UnoCSS + Playwright, so authoring-time correctness ≠ rendered correctness. Text overflows, icons fail to resolve, dark-on-dark contrast, `two-cols` half-misses — none of this shows up until you actually look at the rendered slide. Export to PNG and read the images back before producing the final PDF/PPTX.

```bash
# Render every slide as a PNG into a verification directory (absolute path!)
slidev export slides.md --format png --output /abs/path/to/_check/
```

This produces one PNG per slide (and per click step if `--with-clicks` is also passed) using the **same Playwright pipeline** as the PDF/PPTX export, so what you see is what will ship. Then use the Read tool on each PNG — Claude is multimodal and views the image directly. Don't `ls` the directory and assume success; **look at the pixels**.

Workflow:
1. Export the whole deck to PNG.
2. Read every PNG. For decks larger than ~15 slides, read in batches of 5–10 to keep context manageable.
3. For each issue, edit `slides.md`.
4. Re-render **only changed slides** with `--range`:
   ```bash
   slidev export slides.md --format png --output /abs/path/to/_check/ --range 3,7-9
   ```
5. Re-read just the re-rendered PNGs.
6. Repeat until clean, then proceed to the final-format export in step 4.

**What to look for on every slide (common breakage checklist):**
- **Text overflow** — content runs off the bottom or right edge. Fix: shorter copy, smaller `text-*`, or split into two slides ("one idea per slide").
- **Off-canvas / clipped elements** — absolute-positioned divs escaping the slide. Fix: use `inset-0` rather than hardcoded coords; verify `-z-10` on background layers.
- **Missing icon placeholder** — a square box or empty space where an icon should be means the Iconify name is wrong (typo, wrong collection, or icon not in that set). Fix: confirm the name at https://icones.js.org. `<carbon-rocket>` not `<carbon-rocket-launch>`, etc.
- **Low contrast** — white-on-light or dark-on-dark, often after a per-slide `background:` overrides the theme. Fix: add `class: text-white` (or `text-slate-900`) to the slide frontmatter, or add a `bg-black/60 -z-10` overlay div over photo backgrounds.
- **Code blocks too wide** — horizontally scrolled or clipped. Fix: wrap long lines in source, drop `text-2xl` to `text-xl`, or use `{maxHeight: '400px'}`.
- **Headline misjudged** — `text-4xl` looks small on a title slide; `text-8xl` on a content slide eats the page. Calibrate by eye, not by feel.
- **`two-cols` broken** — right column missing means you forgot the `::right::` marker, or it's not on its own line.
- **Background image not loading** — relative path resolved wrong, or remote URL is 404. The slide will look unstyled.
- **Magic Move misalignment** — successive code blocks have different languages or wildly different token counts, so the morph looks like a cut. Fix: keep the same language across steps and minimize structural change.
- **Click reveals collapsed** — if you exported without `--with-clicks`, all `<v-click>` content shows at once. Re-export with the flag if reveals matter.
- **Per-slide frontmatter ate the slide body** — a missing closing `---` makes Slidev parse your content as YAML, producing a blank slide. Look for unexpectedly empty slides.
- **Theme not applied** — fonts/colors look generic = theme failed to install. Stick to `theme: default` for non-interactive runs, or pre-install.

If everything looks right, move on to step 4. If you fixed anything, **re-verify** — don't trust an unverified edit.

### 4. Convert to the final format

```bash
# PPTX (PowerPoint)
slidev export slides.md --format pptx --output deck.pptx

# PDF (default format)
slidev export slides.md --output deck.pdf

# PDF with click-step animations rendered as separate pages
slidev export slides.md --with-clicks --output deck.pdf

# PNG (one per slide, written into a directory)
slidev export slides.md --format png --output slides-png/

# Static SPA build (deployable HTML/JS/CSS bundle)
slidev build slides.md --out dist

# Dev server (hot reload, presenter mode at /presenter)
slidev slides.md            # opens http://localhost:3030
```

Always pass an absolute path for `--output` / `--out` so the file lands where the user expects.

Useful export flags:
- `--with-clicks` — emit a page per click step (preserves `<v-click>` reveals in PDF/PPTX).
- `--dark` — force dark mode.
- `--range 1,3-5` — export a subset of slides (essential for the verification re-render loop above).
- `--per-slide` — render each slide as its own PDF page render (more reliable for some themes).
- `--executable-path /path/to/chrome` — point at a specific Chromium if Playwright's download is missing.

### 5. Themes
Slidev ships `default` and many community themes (e.g. `seriph`, `apple-basic`, `bricks`, `shibainu`, `academic`, `frankfurt`). Set with `theme: seriph` in headmatter — Slidev will prompt to install the npm package on first run. For non-interactive runs, pre-install globally (`npm i -g @slidev/theme-seriph`) or locally in the project dir, or stick to `theme: default` to avoid the prompt.

Theme picking guide:
- `default` — clean, neutral. Safe choice for tech talks.
- `seriph` — elegant serif headings, looks editorial. Good for narrative decks.
- `apple-basic` — Apple-keynote-inspired, minimal.
- `bricks` — bold, blocky, colorful. Good for marketing/product.
- `academic` — formal, paper-like, supports citations and figures.

---

## Design toolkit (this is how you make slides actually look nice)

### Iconify icons (200k+ icons, inline)
Slidev has built-in Iconify support — drop any icon as a component, no imports needed. Browse at https://icones.js.org.

Syntax: `<{collection}-{icon-name} />`, with UnoCSS classes for sizing and color:

```vue
<carbon-logo-github class="text-4xl" />
<mdi-cellphone class="text-6xl text-blue-500" />
<logos-vue class="w-16 h-16" />               <!-- "logos-" icons keep their brand colors -->
<tabler-rocket class="text-8xl text-orange-400" />
<ph-warning-bold class="text-3xl text-red-500" />
<simple-icons-typescript class="text-5xl text-blue-400" />
```

Best collections for slide design:
- `carbon-` — IBM Carbon, clean and technical
- `logos-` — brand logos in original colors (auto-colored — don't override with `text-*`)
- `mdi-` — Material Design, huge and consistent
- `tabler-` — Tabler, modern outline style
- `ph-` — Phosphor, sleek; suffix variants `-bold`, `-fill`, `-duotone`, `-thin`
- `lucide-` — Lucide, clean outline
- `simple-icons-` — flat brand icons
- `material-symbols-` — Google Material Symbols (3 weights)
- `heroicons-` — Tailwind's own icons
- `fluent-` — Microsoft Fluent

### UnoCSS utility classes (Tailwind-compatible)
Every slide is a regular HTML/Vue tree styled with UnoCSS — same syntax as Tailwind. Drop classes onto any `<div>`, `<span>`, slide `class:` frontmatter, or icon. No config needed.

```markdown
<div class="grid grid-cols-2 gap-12 mt-8">
  <div class="text-blue-400 text-2xl font-semibold">Left column</div>
  <div class="text-pink-400 text-2xl font-semibold">Right column</div>
</div>
```

Classes you'll reach for constantly:
- **Layout:** `grid grid-cols-{2|3|4}`, `gap-{4|8|12}`, `flex`, `items-center`, `justify-{center|between}`, `absolute inset-0`
- **Sizing:** `w-{32|64|full}`, `h-{32|full}`, `max-w-{2xl|4xl}`, `aspect-video`
- **Spacing:** `mt-{4|8|12|16}`, `p-{4|8}`, `space-y-4`
- **Text:** `text-{xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl}`, `font-{light|bold|black}`, `text-center`, `tracking-{tight|wide}`, `leading-{tight|relaxed}`
- **Color:** `text-{red|blue|green|amber|pink|indigo|slate}-{300|400|500|600}`, `text-white/80` (with opacity)
- **Background:** `bg-{slate|zinc|gray}-{800|900|950}`, `bg-gradient-to-br`, `from-blue-500`, `to-purple-600`, `bg-white/10` (translucent)
- **Border/shape:** `rounded-{md|lg|xl|2xl|full}`, `border border-white/20`, `shadow-{lg|xl|2xl}`, `ring-2 ring-blue-400`
- **Effects:** `backdrop-blur-md`, `opacity-{50|70|80}`, `blur-sm`

### Magic Move (animated code transitions) — Slidev's killer feature
Animates between multiple code states with token-level diffing. Use a `magic-move` fenced block containing successive code blocks; each click steps to the next state.

`````markdown
````md magic-move
```js
let count = 0
count = count + 1
```

```js
const [count, setCount] = useState(0)
setCount(c => c + 1)
```

```ts
const count = signal(0)
count.value++
```
````
`````

Each step animates matching tokens between versions — great for showing refactors, before/after, or framework comparisons.

### Code line highlighting and stepping
Within any code block, use `{lines}` to highlight, and `|` to step through:

````markdown
```ts {1|3-4|all}
function greet(name: string) {
  console.log(`Hi, ${name}`)
  return name.toUpperCase()
}
```
````

Each `|` is one click step. Use `{lines: true}` for line numbers and `{maxHeight: '400px'}` for scrollable blocks. Pin a transition with `{at:1}` to align with `<v-click>` steps.

### Click animations
Reveal items one click at a time:

```markdown
<v-clicks>

- First
- Second
- Third

</v-clicks>
```

Or wrap individual elements: `<v-click>...</v-click>`. Use `<v-click at="3">` to fire on the 3rd click; `<v-click hide at="2">` to hide on the 2nd. Pass `--with-clicks` to `export` to render each step as a separate PDF/PPTX page.

### Custom styles
Three places to put CSS:
- **Headmatter `style:`** — global, single CSS string.
- **`<style>` block** on any slide — scoped to that slide's component.
- **`style.css` next to `slides.md`** — auto-loaded; good for longer stylesheets.

```markdown
---
style: |
  .slidev-layout h1 {
    background: linear-gradient(120deg, #f0abfc 0%, #818cf8 100%);
    -webkit-background-clip: text;
    color: transparent;
    letter-spacing: -0.02em;
  }
  .slidev-layout {
    font-feature-settings: 'ss01', 'cv11';
  }
---
```

You can `@apply` UnoCSS utility classes inside CSS, just like Tailwind:

```markdown
<style>
h1 { @apply text-6xl font-black tracking-tight; }
</style>
```

### Fonts (Google Fonts auto-imported)
Set in headmatter — Slidev pulls them from Google Fonts at build time:

```yaml
fonts:
  sans: 'Inter'
  serif: 'EB Garamond'
  mono: 'JetBrains Mono'
  weights: '300,400,500,700,900'
  italic: false
  # provider: 'none'   # set this to skip Google and use local fonts only
```

Reference via `font-sans`, `font-serif`, `font-mono` UnoCSS classes. Good display pairings: Inter + JetBrains Mono (technical); Geist + Geist Mono (modern); EB Garamond + Inter (editorial); Space Grotesk + IBM Plex Mono (distinctive).

### Backgrounds (per slide)
In per-slide frontmatter:

```yaml
background: '#0b1020'                       # solid color
background: https://cover.sli.dev           # remote image
background: ./hero.jpg                      # local image (relative to slides.md)
backgroundSize: contain                     # default: cover
```

For **gradients** or **photo + overlay** patterns, drop an absolute-positioned div behind the content:

```markdown
---
class: text-white
---

<div class="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-rose-900 -z-10" />

# Slide content
```

Photo with a darkening overlay (essential for legibility over photographs):

```markdown
---
background: https://images.unsplash.com/photo-1518770660439-4636190af475
class: text-white
---

<div class="absolute inset-0 bg-black/60 -z-10" />

# Headline that's actually readable
```

### Components (built-in embeds)
- `<Toc maxDepth="1" />` — auto table of contents from `#` headings
- `<TocList />` — list variant
- `<Tweet id="1234567890" />` — embed a tweet
- `<Youtube id="dQw4w9WgXcQ" width="600" height="350" />` — embed a YouTube video
- `<Arrow x1="10" y1="50" x2="200" y2="100" />` — draw an SVG arrow between two coordinates (annotate diagrams)
- `<SlidevVideo>` — local video file player
- `<RenderWhen context="presenter">Only in presenter view</RenderWhen>` — content that only appears in the presenter screen
- `<LightOrDark>` — render different content per color schema

Custom Vue components: drop `.vue` files in a `components/` dir next to `slides.md` and they're auto-registered for use as `<MyComponent />`.

### Math (KaTeX)
- Inline: `$E = mc^2$`
- Block: `$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$`
- Multi-line: `\begin{aligned} ... \end{aligned}` inside a `$$` block.

### Diagrams
- **Mermaid:** ```` ```mermaid ```` blocks render natively. Sequence, flow, class, ER, gantt all supported. Add `{theme: 'forest', scale: 0.8}` after the language tag to configure.
- **PlantUML:** ```` ```plantuml ```` blocks render via the online server by default.

### Transitions between slides
Headmatter `transition:` sets the default; per-slide `transition:` overrides:

```yaml
transition: slide-left          # slide-{left|right|up|down}
transition: fade
transition: fade-out | slide-up # split: out then in (different transitions for leaving vs entering)
transition: view-transition     # CSS View Transitions API (smooth, modern)
```

---

## Built-in layouts (which to use when)
- `cover` — title slide; theme styles it as the deck cover. Use exactly once at the top.
- `intro` — like cover but for a later "intro" beat.
- `section` — section divider; large heading on a colored panel.
- `center` — vertically + horizontally centered. Great for short statements.
- `statement` — even more emphasized than `center`; the headline-only layout.
- `quote` — pull quote with attribution.
- `fact` — single big stat or fact (huge number, small caption).
- `default` — your everyday layout.
- `two-cols` / `two-cols-header` — side-by-side comparisons (use `::right::` to split content).
- `image`, `image-left`, `image-right` — image + content layouts.
- `iframe`, `iframe-left`, `iframe-right` — embed a live URL inside the slide.
- `full` — content fills the entire slide, edge to edge (no padding).
- `end` — closing slide.
- `none` — no layout chrome; you control everything (use with custom CSS / absolute positioning).

`two-cols` example:

```markdown
---
layout: two-cols
---

# Left side
- bullet
- bullet

::right::

# Right side
- bullet
- bullet
```

`image-right` example:

```markdown
---
layout: image-right
image: ./hero.jpg
backgroundSize: contain
---

# Headline next to the image
```

---

## Headmatter cheat sheet (global)
- `theme:` — `default`, `seriph`, or any installed theme.
- `title:` / `info:` — deck metadata (used by SPA build and SEO).
- `author:` / `keywords:` — optional metadata.
- `class:` — UnoCSS classes applied to the first slide.
- `highlighter: shiki` — code highlighter (Shiki is default and recommended).
- `lineNumbers: true` — show line numbers in all code blocks.
- `colorSchema: dark | light | auto` — force theme color schema.
- `transition: slide-left | fade | view-transition` — default slide transition.
- `drawings: { persist: false }` — whether on-screen annotations are saved back to disk.
- `mdc: true` — enable [MDC syntax](https://content.nuxtjs.org/guide/writing/mdc) (inline classes/attrs on Markdown elements).
- `fonts:` — Google Fonts (see Fonts section above).
- `download: true` — adds a "download PDF" button to the SPA build.
- `routerMode: hash | history` — URL style for the SPA.
- `record: dev | build | false` — enable webcam recording in dev/build.

## Per-slide frontmatter (local)
Goes between two `---` lines right after the slide separator:
- `layout:` — see layouts above.
- `background:` — color, gradient, or image URL.
- `class:` — UnoCSS classes on the slide root (`text-center`, `text-white`, etc.).
- `transition:` — override the transition into this slide.
- `clicks:` — pin the click count (rarely needed).
- `hide: true` — skip this slide on render.
- `src: ./other.md` — pull another file's content into this slide (split large decks).
- `disabled: false` — disable a slide without deleting.

## Speaker notes
Put an HTML comment at the **end** of the slide:

```markdown
# Slide title
Body text

<!--
These are presenter notes. They appear in /presenter mode
and inside PPTX speaker notes on export.
-->
```

---

## Making slides actually look good (design tips)
- **One idea per slide.** If you have three points, three slides. Title + one short sentence + maybe an icon beats a wall of bullets every time.
- **Use the layouts, don't reinvent them.** `layout: center` instead of manually centering. `layout: two-cols` instead of building columns. Themes are tuned for these.
- **Lean on icons.** A single big `<logos-typescript class="text-9xl" />` next to a headline reads better than a bulleted list. Pair iconography with headings to give each slide a visual anchor.
- **Big type.** `text-7xl` or `text-8xl` for headlines is normal in slides. If text fits comfortably at desktop reading sizes it's too small for projection.
- **Tracking and leading matter.** `tracking-tight leading-tight` on large headings; `tracking-wide` on small uppercase labels; `leading-relaxed` on body paragraphs.
- **Code is the showcase.** Slidev's Shiki + Magic Move is its superpower. Use Magic Move for refactor / before-after / framework-comparison slides, and `{1|2|all}` line stepping for walking through code one line at a time.
- **Reveal progressively.** Wrap bullets in `<v-clicks>` so audiences track with you instead of reading ahead.
- **Dark by default for projection.** Set `colorSchema: dark`. Use the occasional light slide as a palette break for emphasis.
- **Gradients > flat colors > photos.** A subtle `bg-gradient-to-br from-slate-900 to-indigo-950` is more interesting than flat, but doesn't compete with text the way a photo does. If you do use a photo, always add a `bg-black/60` overlay div for legibility.
- **Whitespace around code.** A code block that fills the slide edge to edge feels cramped. Keep at least `text-2xl` for readability and let the slide breathe.
- **Brand-color icons stay branded.** Use `logos-*` icons for brand marks — don't override with `text-*-500`, they're already colored.
- **Per-slide accents.** A title slide with a bold full-bleed gradient, then content slides with a subtle accent stripe (`<div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-purple-500" />`) ties the whole deck together.

---

## Common gotchas
- **First export is slow.** Playwright downloads Chromium on first export. Subsequent runs are fast.
- **PPTX is image-based.** Slidev rasterizes each slide. Unlike Marp there's no `--pptx-editable` equivalent; users who need fully-editable PowerPoint text have to hand-edit after export.
- **Theme prompt.** If `theme:` references an uninstalled package, `slidev` will prompt interactively. For scripted/non-interactive runs, pre-install the theme or stick to `theme: default`.
- **Per-slide frontmatter is fenced.** Don't forget the second `---` closing the per-slide YAML block, or Slidev reads your slide body as YAML.
- **`---` separates slides.** Make sure separators have blank lines above and below so they aren't parsed as Setext heading underlines.
- **Click-step exports** need `--with-clicks`, otherwise reveals collapse to their final state.
- **Local images** in `slides.md` resolve relative to the `.md` file in dev, `build`, and `export`.
- **`prettier-plugin-slidev` is optional.** It only formats `slides.md` source for hand editing — install only if the user runs Prettier on their slides. It does **not** affect rendered output quality.

## When the user gives an outline, not Markdown
1. Draft `slides.md` from their outline — one `#` per major section, slide breaks with `---`, concise bullets, speaker notes in `<!-- ... -->` comments at the end of each slide.
2. Pick a layout per slide deliberately:
   - Title slide → `cover`.
   - Section dividers → `section`.
   - Comparisons / before-after → `two-cols` or Magic Move.
   - Single big number or claim → `fact` or `statement`.
   - "Showcase" slide with a visual → `image-right` or full-bleed `none` + custom layout.
   - Everything else → `default`.
3. Add an icon to every content slide. A big iconify icon next to or under the headline gives instant visual identity.
4. Default theme to `default` unless the user asks for fancier (avoids the install prompt).
5. Default `colorSchema: dark` and pick a font pair (e.g. `Inter` + `JetBrains Mono`).
6. Use `<v-clicks>` for bullet reveals; use Magic Move for any code refactor / comparison slide.
7. **Verify visually** — export PNGs, read every one, fix issues, re-render changed slides with `--range`, re-read. See step 3 of the workflow above. Don't skip this.
8. Convert to the format they asked for — default to PPTX if they said "PowerPoint" or "pptx", PDF otherwise. Pass `--with-clicks` if there are reveals to preserve.
9. Report the absolute output path.

$ARGUMENTS
