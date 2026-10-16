# Slides and narrated videos: house style

A format that works for talks and explainer videos built with
`excalidraw-story`: every slide is an Excalidraw page, the diagrams are
hand-drawn, and the words are plain type. It came out of building a
lecture deck and its narrated video, and each rule below fixed something
that read badly the first time.

## The page

Every slide and every video frame is one page, 1600 by 900 units.

| Part | Where | Size |
|---|---|---|
| Title | x 120, y 100, left-aligned | 64 |
| Content area | x 120 to 1480, y 220 to 840 | |
| Margins | 120 left and right | |
| Background | white | |

- A **card** (a slide that is not a diagram) is drawn on the page itself:
  an invisible rectangle with id `frame` at (0, 0), 1600 by 900, and the
  title as a text element with id `title`.
- A **diagram** is drawn on any canvas, with an invisible `frame` rectangle
  around the whole drawing in every build step. `excalidraw-story` scales
  it into the content area, centers it, and draws the slide title above
  it, so titles land in the same place and size on every slide. Before
  that, each slide's camera fit its own diagram and the title moved and
  changed size from slide to slide.

## Type

The drawings are hand-drawn; the words are not. Hand-drawn text for
titles and bullets looked odd in a deck.

| Use | Font | Size (page units) |
|---|---|---|
| Slide title | Nunito (`fontFamily: 6`) | 64 |
| Title slide / section card title | Nunito | 120 / 80 |
| List item | Nunito | 48 |
| Lead line, group label, note on code | Nunito | 44 / 40 / 36 |
| Tables, field lists, sources | Nunito | 32 to 40 |
| Code | Cascadia (`fontFamily: 3`) | 26 to 30 |
| Diagram labels, after the fit | Excalifont (`fontFamily: 5`) | 24 or more |

- The headless renderer has no Nunito and would draw Liberation Sans;
  `assets/fonts/Nunito-Regular.ttf` is handed to it by `excalidraw-animate`.
  The canvas's browser tab draws Nunito natively.
- Comic Shanns (`fontFamily: 8`) is not available headless; write code in
  Cascadia.
- `title: {font: 6}` in a story file's front matter sets the font of the
  titles the pipeline draws.
- Left-align text. Labels centered in a diagram's boxes are the exception.

## Color

| Color | Value | Use |
|---|---|---|
| Ink | `#1B2547` | Titles, list items, body |
| Muted | `#7A776E` | Kickers, group labels, row labels |
| Blue | `#1864ab` | Questions to the audience, notes on code, table headers |
| Amber | `#a35200` | The one line a slide lands on; at most one per slide |

Diagram fills and strokes, from Excalidraw's palette: blue
`#d0ebff`/`#1864ab`, amber `#fff3bf`/`#a35200`, green `#d3f9d8`/`#2b8a3e`,
rose `#ffe3e3`/`#c92a2a`, gray `#f1f3f5`/`#343a40`; a dashed gray outline
with no fill for neutral structure (phases, spans of time). Give each color one
meaning for a whole deck (which actor, which kind of thing) and keep it,
so no diagram needs a legend.

## Kinds of slide

A teaching slide is a title plus one of these.

1. **A diagram**, built one step per click from its `steps.json`.
2. **A list that builds**, two to four items, one per click. Each item is a
   blue square marker (18 by 18 at x 130, `roughness: 0`) and its text at
   x 180, rows 115 apart from y 290. Two groups get muted labels above
   their items. Nothing between the title and the list: no subtitle, no
   lead line.
3. **Code with notes**: the real capture in Cascadia in a gray box, short
   blue notes to its right with an arrow from each to its line. Indent
   with non-breaking spaces: the canvas strips leading spaces.
4. **A statement**: one or two plain sentences at 64 to 80 with the line
   that lands in amber, for a rule or takeaway; a few per talk. State the
   fact, no teaser and reveal.
5. **A table**: Nunito, header row in blue, row labels muted, one straight
   rule (`#ced4da`, `roughness: 0`) between rows, spanning x 120 to 1480
   with even gaps of at most 160. The canvas measures every font at a
   flat 0.6 em (Nunito comes out about 27% too wide), so space columns by
   real widths: the rendered still, or the font's own metrics.

No paragraphs in boxes: a definition or a summary is a list of its parts.

Structural slides: a title slide (the title at 120 and one muted line
naming the series and number, nothing else), a schedule (the parts as a list, all at once),
a section card per part (muted "Part N" kicker, the part's name at 80),
an interlude card in the same layout for an activity ("Live demo"), a
**Questions** slide last in a live talk, and an end card in a video
("Thanks for watching" muted under the title).

A list card, as elements for the canvas's `add` (then `export` the
`.excalidraw` and list its steps in `steps.json`):

```json
[{"id": "frame", "type": "rectangle", "x": 0, "y": 0, "width": 1600, "height": 900,
  "strokeColor": "transparent", "backgroundColor": "transparent", "fillStyle": "solid"},
 {"id": "title", "type": "text", "x": 120, "y": 100, "text": "What a long conversation costs",
  "fontSize": 64, "fontFamily": 6, "strokeColor": "#1B2547", "textAlign": "left"},
 {"id": "m0", "type": "rectangle", "x": 130, "y": 310, "width": 18, "height": 18, "roughness": 0,
  "strokeColor": "#1864ab", "backgroundColor": "#d0ebff", "fillStyle": "solid", "strokeWidth": 2},
 {"id": "i0", "type": "text", "x": 180, "y": 290, "text": "The context window fills up",
  "fontSize": 48, "fontFamily": 6, "strokeColor": "#1B2547", "textAlign": "left"}]
```

with steps `[["frame", "title"], ["frame", "title", "m0", "i0"], ...]`.

## Writing on the slide

- **Titles** name what the slide is about: a noun phrase of two to six
  words that covers the whole slide, not a sentence you would say as it
  comes up. The list of titles should read as an outline.
- **List items** are short sentences that name their subject. No "it"
  pointing off the slide ("It fills up"), no fragment without a subject
  ("Keeps your conversation small"), no label joined to a claim with a
  colon ("Claude Code: the model decides"). About seven words, one line,
  four items at most, all starting the same way grammatically. Read only
  the items, in order: they should give the slide's point.
- **No headlinese.** No noun phrase with a second phrase tacked on after a
  comma and no verb between them ("One conversation, an hour in", "Same
  harness, new ways in"). Write one plain phrase ("Your conversation after
  an hour").
- **One phrase per diagram label.** No comma tail adding a second fact.
- **Words on screen are said.** Every content word of a line a click adds
  appears in that click's notes or narration, and the click's notes start
  with the list item word for word. `excalidraw-story check` reports every
  line that is not said. Titles are exempt: they stay on screen, and
  reading them out ("What the model sees. Picture...") sounds stilted.

## A narrated video

- **The video is the deck, narrated, slide for slide.** Keep every slide
  that orients or teaches, in the deck's order. Drop only what works only
  live: an audience discussion, logistics, sources, Questions. A first
  attempt planned as a short summary folded the schedule and the problem
  statement into the title card's narration: a minute of talk with
  nothing on screen to follow.
- **Never move a slide's content into another slide's narration.**
- **Open on the title card already drawn** (`intro: cut`, the default), so
  the first frame and the thumbnail say what this is; speak one short line
  over it. End on an end card held for four seconds (`end_hold`).
- **Sum up the schedule in one flowing sentence**, with its items in
  `silent`. Reading each item aloud sounds like a machine reading a list.
  Other fair `silent` text: lane names, axis ticks, URLs, emails, code.
- **Dates**: abbreviated on screen, written out in narration; the check
  matches "Fri Sep 11" to "Friday, September 11".
- **Write for the ear.** Numbers and names as they are said; start each
  list beat with its item.
- **Compare scene lists before rendering**: the video's `##` scenes in
  order should be the deck's minus the live-only slides.

## Voice: Kokoro

`excalidraw-story video` voices each beat with Kokoro in-process (uv
installs it and its weights, about 330 MB, on the first run).

- **Voices**: `af_heart` (default), `af_bella`, `am_michael`, `am_fenrir`,
  `bf_emma`, `bm_george`; the first letter is the accent (American,
  British), the second the gender.
- **Pronunciation** goes in a lexicon: `{"Navier": {"ipa": "nævjˈA"},
  "K2.5": "K two point five"}`. Kokoro gets IPA inline when an entry has
  it, otherwise the `say` respelling. Prefer IPA: respellings are guesses
  (`ay` comes out as the vowel in "eye"). Leave initialisms bare; spelling
  them out puts stress on every letter. A letter-digit-decimal token like
  `K2.5` reads as "K two five" without an entry.
- **Check a word before trusting it** with misaki, the phonemizer Kokoro
  uses: `from misaki import en, espeak; g2p = en.G2P(trf=False,
  british=False, fallback=espeak.EspeakFallback(british=False));
  print(g2p("Navier Stokes")[0])`. `A` is the vowel in "day", `I` in "eye".
- **You cannot hear it.** Phonemes catch wrong pronunciations; a Whisper
  round trip (mlx-whisper, large-v3-turbo; small.en invents errors) diffed
  against the narration points at the beats worth hearing first, and most
  of its diffs are homophones. A person listens to the whole video before
  it goes anywhere. Never play audio aloud while working.
- Kokoro starts every clip with about 0.3 s of silence, so the voice lands
  `audioDelay` plus 0.3 s after its step starts drawing.
- In a separate venv, misaki's automatic spaCy model download fails under
  uv; install `en_core_web_sm` explicitly (story.py's header does).
