---
name: excalidraw-skill
description: Excalidraw canvas toolkit for creating, editing, and refining diagrams on a live canvas. Use when an agent needs to (1) draw or lay out diagrams, (2) iteratively refine them by describing the scene and screenshotting its own work, (3) export/import .excalidraw files or PNG/SVG images, (4) save/restore canvas snapshots, (5) convert Mermaid to Excalidraw, (6) perform element-level CRUD, alignment, distribution, grouping, duplication, and locking, or (7) animate diagrams into MP4/GIF/WebM videos (excalidraw-animate). Interfaces: MCP tools (preferred when available), the bundled CLI (npx -y mcp-excalidraw-server <command>), or a REST API, all driving the same canvas.
---

# Excalidraw Skill

## Step 0: Pick an Interface

Three interfaces drive the same live canvas. Pick the first one that applies:

1. **MCP tools** — if `excalidraw/*` tools (e.g. `batch_create_elements`) are in your tool list, prefer them: results land directly in your context, and screenshots come back as images without touching disk. If they are listed as deferred, load them all in one ToolSearch call (query `excalidraw`, max 30) instead of one at a time. Use the CLI for what MCP lacks: `apply` (create, update and delete in one call), `snapshot list`, offline `render`, and animation.
2. **CLI** (default when no MCP tools are present):
   ```bash
   npx -y mcp-excalidraw-server <command>
   ```
   No setup needed — any canvas-touching command **auto-starts the canvas server** on `http://127.0.0.1:3081` (first `npx` run downloads the package). If the CLI is installed globally (`npm i -g mcp-excalidraw-server`), the shorter alias `excalidraw-canvas <command>` works too.
3. **REST API** (last resort, e.g. from application code): HTTP endpoints on `http://127.0.0.1:3081` — see `references/cheatsheet.md` for payloads. The server must already be running.

The canvas URL comes from `EXPRESS_SERVER_URL` (set to `http://127.0.0.1:3081` in `~/.claude/settings.json` `env` and the MCP server env in `~/.claude.json`, package default 3000). Screenshots and image exports render headless inside the canvas server, so you never need a browser tab to check your own work. Only mermaid conversion and viewport control need an open tab (CLI exits with code 4 when it's missing). Still tell the user the URL — opening it lets them watch you draw.

On this machine the canvas server on 3081 is the always-on Docker container `mcp-excalidraw-canvas` (image `ghcr.io/yctimlin/mcp_excalidraw-canvas`, host 3081 mapped to container 3000, `--restart unless-stopped`). The image must be at least as new as the npm package, or headless rendering is missing and screenshots silently fall back to the browser renderer. Upgrading recreates the container and wipes its in-memory scene and snapshots, so back them up first. Port 3080 is a separate standalone Excalidraw app (Docker container `excalidraw`, image `excalidraw/excalidraw`) for manual drawing. It is not the agent canvas and the tools above cannot reach it. Keep Excalidraw off 3000 and 8080, which the user reserves for other work.

**Free text alignment:** `x` is always the left edge of a text element's box, even with `textAlign: "center"`. The open browser tab can render center-aligned free text as if `x` were its center, so the browser view and the headless screenshot (and the exported file) disagree. To center free text over a point, set `x = centerX - width/2`. The headless renderer also measures text narrower than a browser does (a 27 px label: 195 px becomes 166 px) and keeps `x`, so in `screenshot` and `render` centered free text sits a little left of where the browser puts it. `excalidraw-animate` corrects both: it keeps each centered label on its middle, and `textX: "center"` reads `x` as the middle for scenes written the browser's way.

### CLI Quick Reference

Results are JSON on stdout — except `describe` (plain text) and raw-content output when `--out` is omitted (`export` scene JSON, `screenshot --format svg`). Diagnostics on stderr. Exit codes: 0 ok, 1 error, 2 usage, 3 canvas unreachable, 4 browser tab required (only `mermaid` and `screenshot --renderer browser`).

| Task | Command |
|------|---------|
| Start / stop / inspect server | `start`, `stop`, `status` |
| Create elements (batch) | `add elements.json` or `echo '[...]' \| add` or `add --one '{...}'` |
| Multi-op patch in one call | `apply patch.json` — `{"create":[...],"update":[{"id":"a","set":{...}}],"delete":[...]}` |
| Read one / query many | `get <id>`, `query [--type t] [--bbox x0,y0,x1,y1] [--filter k=v] [--filter-json '{...}']` |
| Update / delete | `update <id> --set '{...}'`, `delete <id> [...]` |
| Understand the scene | `describe` (plain-text summary: ids, positions, labels, connections) |
| See the scene | `screenshot [--out f.png]` (PNG without `--out` → temp file path in JSON; SVG without `--out` → raw SVG) |
| Layout operations | `arrange align\|distribute\|group\|ungroup\|lock\|unlock\|duplicate --ids a,b,c [--to left\|horizontal\|...]` |
| Scene files | `export [--out scene.excalidraw]`, `import [scene.excalidraw|-] [--replace]` — a `.excalidraw.md` out path writes Obsidian's format (see File I/O) |
| Mermaid → canvas | `mermaid [diagram.mmd|-]` (or stdin) |
| Snapshots | `snapshot save\|list\|restore <name>` |
| Share link | `share` (encrypted upload → excalidraw.com URL) |
| Wipe canvas | `clear --yes` |
| Install / upgrade this skill | `install-skill --dir <skills-root>` (agent chooses project/global root) |

### Element Format (CLI and MCP)

The CLI and MCP tools accept the same agent-friendly format and normalize it automatically:

- **Labels**: put `"text": "My Label"` on any shape — converted to Excalidraw's bound-label format for you.
- **Arrow binding**: `"startElementId": "a"` / `"endElementId": "b"` — arrows auto-route to element edges.
- **fontFamily**: pass a string name (`"helvetica"`, `"cascadia"`, `"excalifont"`, ...) or string number `"1"`–`"8"`.
- **points**: both `[[x,y], ...]` tuples and `[{"x":..,"y":..}]` objects are accepted.
- **Label size**: shape labels always render at fontSize 20. The shape's own `fontSize` is not applied to its label, and the schema strips `label.fontSize` (upstream bug). For larger labels, put a free-standing text element over the shape instead of `text`.
- **Frames**: `"type": "frame"` works, but `name` and children's `frameId` are stripped, so elements drawn inside a frame are not its children on the canvas. `excalidraw-animate --frames` assigns each element to the frame that contains its center.
- **Patch updates**: in `apply`, update entries can use either direct fields (`{"id":"a","x":120}`) or a `set` object (`{"id":"a","set":{"x":120}}`). Do not mix both forms in one update entry.

**Raw REST is stricter**: labels must be `"label": {"text": "..."}`, bindings must be `"start": {"id": "..."}` / `"end": {"id": "..."}`. Only worry about this when POSTing to the API directly.

---

## Coordinate System

The canvas uses a 2D coordinate grid: **(0, 0) is the origin**, **x increases rightward**, **y increases downward**. Plan your layout before writing any JSON.

**General spacing guidelines:**
- Vertical spacing between tiers: 80–120px (enough that arrows don't crowd labels)
- Horizontal spacing between siblings: 40–60px minimum; give labeled arrows 120px+
- Shape width: `max(160, labelCharCount * 12)` to keep the label on one line
- Shape height: 60px single-line, 80px two-line labels
- Background/zone padding: 50px on all sides around contained elements

**Styling for a professional look:**
- `"fillStyle": "solid"` on shapes gives crisp flat fills — the default is a sketchy hachure pattern
- Pair pastel `backgroundColor` fills with their darker `strokeColor` (palette in the cheatsheet)
- `"strokeStyle": "dashed"` on zone borders and async arrows reads as "boundary / background"

---

## Layout Anti-Patterns (Critical for Complex Diagrams)

These are the most common mistakes that produce unreadable diagrams. Avoid all of them.

### 1. Do NOT use `label.text` (or `text`) on large background zone rectangles

When you put a label on a background rectangle, Excalidraw creates a bound text element centered in the middle of that shape — right where your service boxes will be placed. The text overlaps everything inside the zone and cannot be repositioned.

**Wrong:**
```json
{"id": "vpc-zone", "type": "rectangle", "x": 50, "y": 50, "width": 800, "height": 400, "text": "VPC (10.0.0.0/16)"}
```

**Right — use a free-standing text element anchored at the top of the zone:**
```json
{"id": "vpc-zone", "type": "rectangle", "x": 50, "y": 50, "width": 800, "height": 400, "backgroundColor": "#e3f2fd"},
{"id": "vpc-label", "type": "text", "x": 70, "y": 60, "width": 300, "height": 30, "text": "VPC (10.0.0.0/16)", "fontSize": 18}
```

The free-standing text element sits at the top corner of the zone and doesn't interfere with elements placed inside.

### 2. Avoid cross-zone arrows in complex diagrams

An arrow from an element in one layout zone to an element in a distant zone will draw a long diagonal line crossing through everything in between. In a multi-zone infra diagram this produces an unreadable tangle of spaghetti.

**Design rule:** Keep arrows within the same zone or tier. To show cross-zone relationships, use annotation text or separate the zones so their edges are adjacent (no elements between them), and route the arrow along the edge.

If you must connect across zones, use an elbowed arrow that travels along the perimeter — never through the middle of another zone.

### 3. Use arrow labels sparingly

Arrow labels are placed at the midpoint of the arrow. On short arrows, they overlap the shapes at both ends. On crowded diagrams, they collide with nearby elements.

- Only add an arrow label when the relationship name is genuinely essential (e.g., protocol, port number, data direction).
- If you're adding a label to every arrow, reconsider — it usually adds visual noise, not clarity.
- Keep arrow labels to ≤ 12 characters. Prefer omitting them entirely on dense diagrams.

---

## Quality: Why It Matters (and How to Check)

Excalidraw diagrams are visual communication. If text is cut off, elements overlap, or arrows cross through unrelated shapes, the diagram becomes confusing and unprofessional — it defeats the whole purpose of drawing it. So after every batch of elements, verify before adding more.

### Quality Checklist

After each `add` / `apply` / `batch_create_elements`, take a screenshot and check:

1. **Text truncation** — Is all label text fully visible? Truncated text means the shape is too small. Increase `width` and/or `height`.
2. **Overlap** — Do any shapes share the same space? Background zones must fully contain children with padding.
3. **Arrow crossing** — Do arrows cut through unrelated elements? If yes, route them around using curved or elbowed arrows (see Arrow Routing below).
4. **Arrow-label overlap** — Arrow labels sit at the midpoint. If they overlap a shape, shorten the label or adjust the arrow path.
5. **Spacing** — At least 40px gap between elements. Cramped layouts are hard to read.
6. **Readability** — Font size ≥ 16 for body text, ≥ 20 for titles.
7. **Zone label placement** — If you used `text`/`label.text` on a background zone rectangle, the zone label will be centered in the middle of the zone, overlapping everything inside. Fix: delete the bound text element and add a free-standing text element at the top of the zone instead (see Layout Anti-Patterns above).

If you find any issue: **stop, fix it, re-screenshot, then continue.** Say "I see [issue], fixing it" rather than glossing over problems. Only proceed once all checks pass.

---

## Workflow: Drawing a New Diagram

### Mermaid vs. Direct Creation — Which to Use?

**Use `mermaid` / `create_from_mermaid`** when: the user already has a Mermaid diagram, or the structure maps cleanly to a flowchart/sequence/ER diagram with standard Mermaid syntax. It's fast and handles conversion automatically, though you get less control over exact layout.

**Create elements directly** when: you need precise layout control, the diagram type doesn't map to Mermaid well (e.g., custom architecture, annotated cloud diagrams), or you want elements positioned in a specific coordinate grid.

### Steps (CLI shown; MCP tools are 1:1 — see cheatsheet)

1. Plan your coordinate grid — map out tiers and x-positions before writing JSON. (MCP mode: call `read_diagram_guide` for colors/sizing; the same guidance lives in `references/cheatsheet.md`.)
2. Optional fresh start: `npx -y mcp-excalidraw-server clear --yes`
3. Create shapes and arrows in one call. Custom `id` fields (e.g. `"id": "auth-svc"`) make later updates easy:
   ```bash
   npx -y mcp-excalidraw-server add - <<'EOF'
   [
     {"id": "lb", "type": "rectangle", "x": 300, "y": 50, "width": 180, "height": 60, "text": "Load Balancer"},
     {"id": "svc-a", "type": "rectangle", "x": 100, "y": 200, "width": 160, "height": 60, "text": "Web Server 1"},
     {"id": "svc-b", "type": "rectangle", "x": 450, "y": 200, "width": 160, "height": 60, "text": "Web Server 2"},
     {"id": "db", "type": "rectangle", "x": 275, "y": 350, "width": 210, "height": 60, "text": "PostgreSQL"},
     {"type": "arrow", "x": 0, "y": 0, "startElementId": "lb", "endElementId": "svc-a"},
     {"type": "arrow", "x": 0, "y": 0, "startElementId": "lb", "endElementId": "svc-b"},
     {"type": "arrow", "x": 0, "y": 0, "startElementId": "svc-a", "endElementId": "db"},
     {"type": "arrow", "x": 0, "y": 0, "startElementId": "svc-b", "endElementId": "db"}
   ]
   EOF
   ```
   (The `-` positional is optional — with no file argument, `add` reads stdin.)
4. Set shape widths using `max(160, labelLength * 12)`.
5. `screenshot` → view the file → run the Quality Checklist → fix issues before the next batch.

---

## Arrow Routing — Avoid Overlaps

Straight arrows can cross through elements in complex diagrams. Use curved or elbowed arrows when needed:

**Curved arrows** (smooth arc over obstacles):
```json
{
  "type": "arrow", "x": 100, "y": 100,
  "points": [[0, 0], [50, -40], [200, 0]],
  "roundness": {"type": 2}
}
```
The intermediate waypoint `[50, -40]` lifts the arrow upward. `roundness: {type: 2}` makes it smooth.

**Elbowed arrows** (right-angle / L-shaped routing):
```json
{
  "type": "arrow", "x": 100, "y": 100,
  "points": [[0, 0], [0, -50], [200, -50], [200, 0]],
  "elbowed": true
}
```

**When to use which:**
- Fan-out (one source → many targets): curved arrows with waypoints spread to avoid overlapping
- Cross-lane (connecting to side panels): elbowed arrows that go up, then across, then down
- Long horizontal connections: curved arrows with a slight vertical offset

**Rule:** If an arrow would pass through an unrelated shape, add a waypoint to route around it.

---

## Workflow: Iterative Refinement

Pairing `describe` with `screenshot` is what makes this skill powerful.

- **`describe`** (`describe_scene` in MCP) → structured text: element IDs, types, positions, labels, connections. Use it to know *what's on the canvas* before making programmatic updates (find IDs, understand bounding boxes).
- **`screenshot`** (`get_canvas_screenshot` in MCP) → PNG rendered headless from the canonical canvas state with Excalidraw's own renderer (no browser tab needed, a few ms). Use it for *visual quality verification* — it shows exactly what the diagram looks like, including truncation, overlap, and arrow routing. The CLI prints the saved file path as JSON; read/view that file. `--scale 2` for legibility on dense diagrams, `--ids a,b` or `--frame <id>` to zoom in on a part, `--dark` for dark mode.

**Feedback loop:**
```
add elements
  → screenshot → view → "text truncated on auth-svc"
  → update auth-svc --set '{"width": 220}' → screenshot → "overlap between auth-svc and rate-limiter"
  → update rate-limiter --set '{"x": 520}' → screenshot → "all checks pass"
  → proceed
```

## Workflow: Refine an Existing Diagram

1. `describe` to understand current state — note element IDs and positions.
2. Identify elements by `id` or label text (not by x/y coordinates — they change).
3. `update <id> --set '{...}'` to resize/recolor/move; `delete <id>` to remove; or bundle everything in one `apply` patch. **Bound arrows re-route automatically when you move or resize their endpoints** — no need to delete and recreate them.
4. `screenshot` to confirm the change looks right.
5. If updates fail: check the ID exists with `get <id>`; unlock with `arrange unlock --ids <id>` if locked.

## Workflow: Mermaid Conversion

```bash
echo 'graph TD
  A[Client] --> B[API]
  B --> C[(DB)]' | npx -y mcp-excalidraw-server mermaid
```
Requires an open browser tab (conversion runs in the frontend; exit code 4 tells you to open the canvas URL). Afterwards `screenshot` to verify layout. If the auto-layout is poor (nodes crowded, edges crossing), find problem elements with `describe` and reposition them with `update`.

## Workflow: File I/O

- Export scene: `export --out diagram.excalidraw` (no `--out` → JSON to stdout)
- Import scene: `import diagram.excalidraw` (append) or `import diagram.excalidraw --replace`
- Image: `screenshot --out diagram.png` / `screenshot --format svg --out diagram.svg` (headless; SVGs embed their fonts)
- Offline: `render diagram.excalidraw --out diagram.png` renders a saved file without the canvas server (CI-friendly, same flags as `screenshot`)
- Share link: `share` — encrypts the scene and returns a shareable excalidraw.com URL

This is how diagrams live in a repo: commit the `.excalidraw` file, and re-`import` + edit + `export` it when the architecture changes.

### Obsidian vaults: use `.excalidraw.md`

Check the destination before writing: if any ancestor directory contains `.obsidian/`, it is an Obsidian vault. A raw `.excalidraw` file there opens in the Excalidraw plugin only in **compatibility mode** ("Convert to new format" warning), gets no block references or vault-wide search, and default Obsidian Sync skips non-`.md` files. Give the export a `.excalidraw.md` extension and the CLI writes the plugin's native format automatically:

```bash
npx -y mcp-excalidraw-server export --out "$VAULT/diagrams/system-map.excalidraw.md"   # .md → Obsidian format (or force with --format obsidian)
npx -y mcp-excalidraw-server import "$VAULT/diagrams/system-map.excalidraw.md" --replace  # reads both plain and compressed Drawing blocks
```

Round-trips are safe: text-element block references follow the plugin's own id rules, so re-importing, editing, and re-exporting the same file keeps links from other notes intact.

## Workflow: Snapshots

1. `snapshot save <name>` before risky changes.
2. Make changes, evaluate with `describe` / `screenshot`.
3. `snapshot restore <name>` to roll back if needed. `snapshot list` shows what's saved.

## Workflow: Animation (MP4 / GIF / WebM)

`excalidraw-animate` (on PATH, a wrapper for `scripts/animate.mjs`) renders video with the same headless renderer as `screenshot`. It needs no flags: MP4/WebM default to 1920x1080 at 30 fps and GIF to 960x540 at 20 fps. The first scene draws in from empty, transitions take 1.2 s, and each step holds for 1.2 s.

| Goal | Command |
|------|---------|
| Draw the current canvas in, element by element | `excalidraw-animate` → `animation.mp4` |
| Same for a file | `excalidraw-animate diagram.excalidraw` → `diagram.mp4` |
| Step-by-step explainer on one canvas | Put each step in its own frame (`"type": "frame"`), laid out left to right, then `excalidraw-animate --frames`. The camera moves to each frame in turn and that frame's content draws in on arrival. Frame borders are not rendered. |
| Show change over time (move, recolor, add, remove) | `snapshot save demo-1`, edit, `snapshot save demo-2`, ..., then `excalidraw-animate --snapshots demo-` |
| A diagram's slide builds | `excalidraw-animate --steps diagram.excalidraw` reads the `steps.json` beside it (`{"diagram": [[ids in step 0], [ids in step 1], ...]}`) and makes one keyframe per step |
| Narrated video | A storyboard with a voice clip and its words on each keyframe (see below) |
| Full control | `excalidraw-animate storyboard.json` |

How motion is decided, so you can draw for it:

- Elements match across steps by `id`. An element with the same id moves, resizes, recolors and reshapes, and changed text fades out and back in. Keep ids stable for anything that should move rather than reappear.
- New elements enter in creation (z) order: arrows grow along their path, rectangles, ellipses and diamonds draw their outline on and then fill, and text fades in. An arrow waits for the shapes it connects. Create elements in the order they should appear.
- Removed elements fade out.

Flags: `--out` (`.mp4`, `.webm`, `.gif`, or a directory for PNG frames), `--duration`, `--hold`, `--boil 8` (hand-drawn wobble), `--dark`, `--no-intro`, `--width`/`--height`, `--fps`, `--padding`, `--text-x left|center`, `--sheet sheet.png`, `--check`, `--strict`.

Storyboard keyframe fields: `scene` (file, `snapshot:<name>`, `canvas`, or an inline element array), `step` (one build step of a scene file, from its `steps.json`), `ids` (only these elements), `add` (extra elements over the scene, such as a title), `clear` (a new scene: the old one fades out, the camera cuts, then this one draws in even where ids repeat), `audio`, `audioDelay`, `narration`, `textX`, `duration`, `hold`, `stagger`, `enterDelay`, `easing`, `enter` (`auto|draw|pop|fade|rise|type|none`), `styles` (`{"<id>": "type"}`, a bound label's id is `<containerId>::label`), `order`, and `camera` (`{"fit": ["id", ...], "padding": 40}` or `{x, y, width, height}`). The full reference is at the bottom of the script.

For video, text has to read in the widest shot at 1080p. Keep the scene close to 16:9 and use `fontSize` 28 or more for free text. Shape labels render at 20 on the canvas whatever the shape's `fontSize` (see Element Format). Keyframe files passed to `excalidraw-animate` are the exception, because the script carries a shape's `fontSize` into its label.

Check the result before handing it over. `--sheet sheet.png` writes contact sheets of every keyframe's finished frame, 20 to a page (`sheet-1.png`, `sheet-2.png`, ... when there are more), so you can check every step without watching the video. Any ffmpeg tile command works on a `--out frames` directory too, but the sheet picks the right frames for you.

### Narrated video

Voice each beat as its own audio file (any TTS), then give every keyframe its clip and the words it says:

```json
{"output": "explainer.mp4", "textX": "center",
 "keyframes": [
  {"scene": "title.excalidraw", "audio": "beats/00.wav", "narration": "Subagents. Lecture 14."},
  {"scene": "split.excalidraw", "step": 0, "clear": true, "audio": "beats/01.wav", "narration": "..."},
  {"scene": "split.excalidraw", "step": 1, "audio": "beats/02.wav", "narration": "..."},
  {"scene": "end.excalidraw", "clear": true, "audio": "beats/03.wav", "hold": 3, "narration": "..."}]}
```

- The voice starts as the keyframe's drawing starts, and the keyframe holds until the voice ends plus `hold` (default 0.5 s), so the picture follows the voice and the two cannot drift. Many TTS engines put silence at the start of each clip; measure it before adding `audioDelay`.
- Run `--check` first. It prints the length and every line of on-screen text the narration never says, without rendering. Viewers read along while they listen, so a label the voice does not say reads as the two disagreeing. Write each list item as the phrase the narration says, and start the beat with it. `--strict` makes any such line fatal.
- Use `clear` at every scene change. Different scenes reuse ids like `title` or `frame`, and without it those elements morph into each other.
- Open on a title card that is already on screen in the first frame (`"duration": 0` on the first keyframe), so the thumbnail and the first second say which video this is. End on a closing card that says what was watched, held for a few seconds, so the end reads as the end.
- Long holds cost little disk: held frames are hard links. A 16-minute narrated video (80 beats) took 9 minutes to draw and encode.

### Pipeline: excalidraw-story

For a narrated video or a slide deck, write one story file and let `excalidraw-story` (wrapper for `scripts/story.py`, a uv script) build the storyboard, voices and checks. No per-project build script.

```markdown
---
scenes: [cards, ../diagrams]     # searched in order for <scene>.excalidraw; steps from steps.json beside it
video: out/explainer.mp4
lexicon: [lexicon.json]          # pronunciations: {"Navier": {"ipa": "nævjˈA"}, "K2.5": "K two point five"}
silent: {fork-diagram: [t1, t2]} # labels the words need not say
slides: {file: deck/slides.md, images: deck/img, headmatter: {title: Subagents}}
---
## title-card 0
This is Lecture 14: Subagents.
## split 0 | A task split into parts
A task split into parts. The main conversation holds your request.
## split 1
Each part goes to a conversation of its own...
```

Each `## <scene> [<step>] [| <title>]` is a beat. A `|` title is drawn above the scene unless the scene has its own `title` element. A new scene clears the old one. Other front matter: `work` (cache dir), `voice`, `speed`, `audio_delay` (0.3), `gap` (0.5), `scene_gap` (1.0), `end_hold` (4.0), `text_x` (`auto` reads whole-number x on centered text as the middle), `title` ({size, color, gap}), `strict` (true), `intro` (`cut`, the default, opens on the first scene already drawn so the first frame shows what is playing; `draw` draws it in from white).

| Command | Does |
|---------|------|
| `excalidraw-story check story.md` | Every scene and step exists, speech lint (initialism hyphens, abbreviated dates, `1M`, bare URLs, `K2.5`-style versions), and every line of on-screen text said in its beat. Under a second, no render. Exit 1 on unspoken text. |
| `excalidraw-story video story.md` | The same checks, then Kokoro voices each beat (cached by what it says, so one edit re-voices one beat), then one render with each keyframe held to its voice, plus contact sheets in `<work>/sheet-N.png`. |
| `excalidraw-story slides story.md` | Each beat as a still in `slides.images`, and a Slidev deck in `slides.file`: one slide per scene, its beats as `v-switch` clicks, a hidden H1 for the title, the beat words as notes joined by "Click.". Unspoken text only warns, and beats may have no words. |

The first run downloads Kokoro and its weights (about 330 MB) through uv. A beat's words are the narration or the notes, so the check that keeps a video's voice and picture in agreement does the same for a deck.

Requires `ffmpeg` and mcp-excalidraw-server 2.1 or later (npx cache or global). The script imports the package's internal render modules (`dist/core/render`). If an upgrade breaks it, check those exports first.

## Workflow: Duplication

`arrange duplicate --ids a,b --offset 40,40` (default offset 20,20). Useful for repeated patterns or copying layouts.

## Error Recovery

- **Exit code 3 (canvas unreachable)?** Auto-start is disabled (`EXCALIDRAW_NO_AUTOSTART=1`) or a non-loopback `EXPRESS_SERVER_URL` is set. Run `start` explicitly or fix the env.
- **Exit code 4 (browser required)?** Only `mermaid` and `screenshot --renderer browser` need an open tab. Open `http://127.0.0.1:3081` in a browser and retry, or drop `--renderer browser` — screenshots and image exports render headless.
- **Elements not appearing?** Check `describe` — they may be off-screen. In MCP mode, use `set_viewport` with `scrollToContent: true`, or `scrollToElementIds` plus optional `viewportZoomFactor` to focus on a specific subgraph; in a browser, press the zoom-to-fit button.
- **Arrow not connecting?** Verify element IDs with `get <id>`. Make sure `startElementId`/`endElementId` match existing element IDs.
- **Canvas in a bad state?** `snapshot save` first, then `clear --yes` and rebuild. Or `snapshot restore` to go back.
- **Element won't update?** It may be locked — `arrange unlock --ids <id>` first.
- **Duplicate text elements / element count doubling?** The frontend auto-sync timer periodically writes the full Excalidraw scene back to the server. Excalidraw internally generates a bound text element for every shape with a label; clearing and re-sending elements can re-inject cached bound texts. Clean up: `query --type text` to find elements with a `containerId`, `delete` the unwanted ones, wait a few seconds for auto-sync to settle. The safest prevention: **never put labels on background zone rectangles** — use free-standing text elements.

---

## References

- `references/cheatsheet.md`: full CLI reference, the 26 MCP tools, REST API endpoints + payload shapes, and the diagram design guide (colors, sizing).
