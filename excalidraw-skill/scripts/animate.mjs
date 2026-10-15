#!/usr/bin/env node
// Turn a sequence of Excalidraw scenes (keyframes) into an MP4 / WebM / GIF or
// a PNG frame sequence. Elements are matched across keyframes by id: shared
// elements morph (position, size, color, points, opacity), new elements enter
// (drawn on, popped or faded in, one after another), and removed elements fade
// out. Rendering reuses mcp-excalidraw-server's headless Excalidraw renderer,
// so frames look exactly like the canvas screenshots.
//
//   node animate.mjs storyboard.json [--out out.mp4]
//   node animate.mjs a.excalidraw b.excalidraw ... --out out.mp4 [--intro]
//        [--duration 0.8] [--hold 1.2] [--fps 30] [--width 1920] [--height 1080]
//
// See the storyboard reference at the bottom of this file.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';

// ---------------------------------------------------------------------------
// Locate mcp-excalidraw-server's renderer. Its render modules are internal
// (dist/core/render), so they are imported by file path.

function findServerDir() {
  const candidates = [];
  if (process.env.EXCALIDRAW_SERVER_DIR) candidates.push(process.env.EXCALIDRAW_SERVER_DIR);
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    candidates.push(path.join(globalRoot, 'mcp-excalidraw-server'));
  } catch {}
  const npxRoot = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npxRoot)) {
    for (const hash of fs.readdirSync(npxRoot)) {
      candidates.push(path.join(npxRoot, hash, 'node_modules', 'mcp-excalidraw-server'));
    }
  }
  const found = candidates
    .filter(dir => fs.existsSync(path.join(dir, 'dist', 'core', 'render', 'index.js')))
    .map(dir => ({ dir, version: JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version }))
    .sort((a, b) => compareVersions(b.version, a.version));
  if (found.length === 0) {
    fail('mcp-excalidraw-server >= 2.1 not found. Run `npx -y mcp-excalidraw-server status` once, or set EXCALIDRAW_SERVER_DIR.');
  }
  return found[0].dir;
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

function fail(message) {
  process.stderr.write(`animate: ${message}\n`);
  process.exit(1);
}

const SERVER_DIR = findServerDir();
const RENDER_DIR = path.join(SERVER_DIR, 'dist', 'core', 'render');
const { prepareScene, renderSvgWithExcalidraw } = await import(path.join(RENDER_DIR, 'excalidraw-node', 'index.js'));
const { loadExcalidrawNode } = await import(path.join(RENDER_DIR, 'excalidraw-node', 'dom.js'));
const { svgToPng } = await import(path.join(RENDER_DIR, 'png.js'));
const fonts = await import(path.join(RENDER_DIR, 'fonts.js'));
const { isObsidianExcalidrawMd, extractSceneJsonFromObsidianMd } = await import(path.join(SERVER_DIR, 'dist', 'core', 'obsidian-md.js'));
const { prepareElement } = await import(path.join(SERVER_DIR, 'dist', 'core', 'normalize.js'));
const { getCommonBounds } = await loadExcalidrawNode();

const CANVAS_URL = process.env.EXPRESS_SERVER_URL || 'http://127.0.0.1:3000';

// ---------------------------------------------------------------------------
// Easing

const EASINGS = {
  linear: t => t,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};

function easing(name) {
  const fn = EASINGS[name ?? 'inOutCubic'];
  if (!fn) fail(`unknown easing "${name}" (use ${Object.keys(EASINGS).join(', ')})`);
  return fn;
}

const clamp01 = t => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;

// Progress of a sub-window [start, start+length] of a transition, 0..1.
function windowProgress(time, start, length) {
  if (length <= 0) return time >= start ? 1 : 0;
  return clamp01((time - start) / length);
}

// ---------------------------------------------------------------------------
// Colors: Excalidraw stores hex (#rgb, #rrggbb, #rrggbbaa) or "transparent".

function parseColor(value) {
  if (!value || value === 'transparent') return null;
  let hex = String(value).replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return undefined;
  return [0, 2, 4, 6].map(i => (i < hex.length ? parseInt(hex.slice(i, i + 2), 16) : 255));
}

function lerpColor(a, b, t) {
  if (a === b) return a;
  let ca = parseColor(a);
  let cb = parseColor(b);
  if (ca === undefined || cb === undefined) return t < 0.5 ? a : b;
  if (ca === null && cb === null) return a;
  // "transparent" interpolates as the other color at zero alpha.
  if (ca === null) ca = [...cb.slice(0, 3), 0];
  if (cb === null) cb = [...ca.slice(0, 3), 0];
  const mixed = ca.map((c, i) => Math.round(lerp(c, cb[i], t)));
  if (mixed[3] === 0) return 'transparent';
  return '#' + mixed.map(c => c.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Polylines: arrows, lines and freedraw store points relative to (x, y).

function pathLengths(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    lengths.push(lengths[i - 1] + Math.hypot(dx, dy));
  }
  return lengths;
}

// The first `fraction` of the path by arc length, ending on an interpolated point.
function truncatePath(points, fraction) {
  if (fraction >= 1 || points.length < 2) return points;
  const lengths = pathLengths(points);
  const target = lengths[lengths.length - 1] * Math.max(fraction, 0.001);
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (lengths[i] < target) {
      out.push(points[i]);
      continue;
    }
    const segment = lengths[i] - lengths[i - 1] || 1;
    const u = (target - lengths[i - 1]) / segment;
    out.push([lerp(points[i - 1][0], points[i][0], u), lerp(points[i - 1][1], points[i][1], u)]);
    break;
  }
  return out;
}

// Resample a path to `count` points spaced evenly by arc length, so two paths
// with different point counts can be interpolated point by point.
function resamplePath(points, count) {
  if (points.length === count) return points;
  const lengths = pathLengths(points);
  const total = lengths[lengths.length - 1];
  const out = [];
  let segment = 1;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (segment < points.length - 1 && lengths[segment] < target) segment++;
    const span = lengths[segment] - lengths[segment - 1] || 1;
    const u = clamp01((target - lengths[segment - 1]) / span);
    out.push([lerp(points[segment - 1][0], points[segment][0], u), lerp(points[segment - 1][1], points[segment][1], u)]);
  }
  return out;
}

function lerpPoints(a, b, t) {
  const count = Math.max(a.length, b.length);
  const ra = resamplePath(a, count);
  const rb = resamplePath(b, count);
  return ra.map((p, i) => [lerp(p[0], rb[i][0], t), lerp(p[1], rb[i][1], t)]);
}

// Outline of a closed shape as points relative to its (x, y), used to draw the
// shape on stroke by stroke before the real element fades in.
function outlinePoints(el) {
  const { width: w, height: h } = el;
  if (el.type === 'ellipse') {
    const steps = 48;
    const pts = [];
    // Start at the top and go clockwise, like a hand would.
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / steps;
      pts.push([w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)]);
    }
    return pts;
  }
  if (el.type === 'diamond') return [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2], [w / 2, 0]];
  return [[0, 0], [w, 0], [w, h], [0, h], [0, 0]];
}

// ---------------------------------------------------------------------------
// Scene loading

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) fail(`GET ${url} -> ${response.status}`);
  return response.json();
}

// Returns { elements, files }; `files` holds image data for image elements.
async function loadSceneSource(source, baseDir) {
  if (Array.isArray(source)) return { elements: source, files: {} };
  if (source && typeof source === 'object') return { elements: source.elements, files: source.files ?? {} };
  if (source === 'canvas' || source.startsWith('snapshot:')) {
    const files = (await fetchJson(`${CANVAS_URL}/api/files`)).files ?? {};
    if (source === 'canvas') return { elements: (await fetchJson(`${CANVAS_URL}/api/elements`)).elements, files };
    const name = encodeURIComponent(source.slice('snapshot:'.length));
    return { elements: (await fetchJson(`${CANVAS_URL}/api/snapshots/${name}`)).snapshot.elements, files };
  }
  const file = path.resolve(baseDir, source);
  if (!fs.existsSync(file)) fail(`keyframe not found: ${file} (use a file path, "snapshot:<name>", or "canvas")`);
  let raw = fs.readFileSync(file, 'utf8');
  if (isObsidianExcalidrawMd(raw)) raw = extractSceneJsonFromObsidianMd(raw);
  const data = JSON.parse(raw);
  return Array.isArray(data) ? { elements: data, files: {} } : { elements: data.elements, files: data.files ?? {} };
}

// Accept the same agent shorthand as the CLI and MCP tools (`text` on shapes,
// `startElementId` / `endElementId` on arrows); native elements pass through.
function expandShorthand(elements) {
  const expanded = elements.map(el =>
    el.startElementId || el.endElementId || (el.text && el.type !== 'text') ? prepareElement(el) : el,
  );
  routeBoundArrows(expanded);
  return expanded;
}

// Where a ray from a shape's center toward (tx, ty) leaves the shape.
// Same geometry as the canvas server's computeEdgePoint.
function edgePoint(el, tx, ty) {
  const hw = (el.width || 0) / 2;
  const hh = (el.height || 0) / 2;
  const cx = el.x + hw;
  const cy = el.y + hh;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy + hh };
  if (el.type === 'diamond') {
    const scale = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    return { x: cx + dx * scale, y: cy + dy * scale };
  }
  const angle = Math.atan2(dy, dx);
  if (el.type === 'ellipse') return { x: cx + hw * Math.cos(angle), y: cy + hh * Math.sin(angle) };
  const tan = Math.tan(angle);
  if (Math.abs(tan * hw) <= hh) {
    const sign = dx >= 0 ? 1 : -1;
    return { x: cx + sign * hw, y: cy + sign * hw * tan };
  }
  const sign = dy >= 0 ? 1 : -1;
  return { x: cx + (sign * hh) / tan, y: cy + sign * hh };
}

// The canvas server routes shorthand arrows (start/end refs) edge to edge when
// they are created; the headless renderer does not, so do it here for scenes
// loaded from files. Mirrors the server's resolveArrowBindings, 8px gap included.
function routeBoundArrows(elements) {
  const byId = new Map(elements.map(el => [el.id, el]));
  const GAP = 8;
  for (const el of elements) {
    if ((el.type !== 'arrow' && el.type !== 'line') || (!el.start && !el.end)) continue;
    const startEl = el.start ? byId.get(el.start.id) : undefined;
    const endEl = el.end ? byId.get(el.end.id) : undefined;
    const center = s => ({ x: s.x + (s.width || 0) / 2, y: s.y + (s.height || 0) / 2 });
    const startCenter = startEl ? center(startEl) : { x: el.x, y: el.y };
    const endCenter = endEl ? center(endEl) : { x: el.x + 100, y: el.y };
    const startPt = startEl ? edgePoint(startEl, endCenter.x, endCenter.y) : startCenter;
    const endPt = endEl ? edgePoint(endEl, startCenter.x, startCenter.y) : endCenter;
    const dist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y) || 1;
    const ux = (endPt.x - startPt.x) / dist;
    const uy = (endPt.y - startPt.y) / dist;
    el.x = startPt.x + ux * GAP;
    el.y = startPt.y + uy * GAP;
    el.points = [[0, 0], [endPt.x - ux * GAP - el.x, endPt.y - uy * GAP - el.y]];
  }
}

// Prepare a keyframe the way the canvas tab would (agent shorthand like
// `text`/`label` and start/end bindings become native elements), then give
// bound labels stable ids so they match across keyframes.
async function normalizeKeyframe(elements) {
  const live = await prepareScene(elements.filter(el => el && !el.isDeleted));
  const renamed = new Map();
  for (const el of live) {
    if (el.type === 'text' && el.containerId) renamed.set(el.id, `${el.containerId}::label`);
  }
  return live.map(el => {
    const copy = structuredClone(el);
    if (renamed.has(copy.id)) copy.id = renamed.get(copy.id);
    if (Array.isArray(copy.boundElements)) {
      copy.boundElements = copy.boundElements.map(b => (renamed.has(b.id) ? { ...b, id: renamed.get(b.id) } : b));
    }
    return copy;
  });
}

// ---------------------------------------------------------------------------
// Camera: a frame element passed to Excalidraw's exporter clips the render to
// its bounds, so moving or resizing it pans and zooms.

function boundsOf(elements) {
  const visible = elements.filter(el => !el.isDeleted);
  if (visible.length === 0) return { x: 0, y: 0, width: 100, height: 100 };
  const [x1, y1, x2, y2] = getCommonBounds(visible);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

// Grow a rectangle around its center to the output aspect ratio, with padding.
function fitAspect(rect, aspect, padding) {
  let width = rect.width + padding * 2;
  let height = rect.height + padding * 2;
  if (width / height > aspect) height = width / aspect;
  else width = height * aspect;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

function resolveCamera(spec, elements, aspect, padding) {
  if (!spec) return null;
  if (Array.isArray(spec.fit)) {
    const wanted = new Set(spec.fit);
    const chosen = elements.filter(el => wanted.has(el.id) || (el.containerId && wanted.has(el.containerId)));
    if (chosen.length === 0) fail(`camera.fit matched no elements: ${spec.fit.join(', ')}`);
    return fitAspect(boundsOf(chosen), aspect, spec.padding ?? padding);
  }
  return fitAspect({ x: spec.x, y: spec.y, width: spec.width, height: spec.height }, aspect, 0);
}

function lerpRect(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t) };
}

// ---------------------------------------------------------------------------
// Transitions

const LINEAR_TYPES = new Set(['arrow', 'line', 'freedraw']);
const OUTLINE_TYPES = new Set(['rectangle', 'ellipse', 'diamond']);

function defaultEnterStyle(el) {
  if (LINEAR_TYPES.has(el.type)) return 'draw';
  if (OUTLINE_TYPES.has(el.type)) return 'draw';
  if (el.type === 'text') return 'fade';
  return 'fade';
}

// Elements that enter together: a shape with its label, or one Excalidraw group.
function unitKey(el) {
  if (el.containerId) return el.containerId;
  if (Array.isArray(el.groupIds) && el.groupIds.length > 0) return `group:${el.groupIds[el.groupIds.length - 1]}`;
  return el.id;
}

// Order entering units by keyframe order (z-order, usually creation order),
// then an explicit `order` list, and keep each arrow after the shapes it joins.
function orderUnits(entering, order) {
  const units = new Map();
  for (const el of entering) {
    const key = unitKey(el);
    if (!units.has(key)) units.set(key, []);
    units.get(key).push(el);
  }
  let keys = [...units.keys()];
  if (Array.isArray(order)) {
    const rank = id => {
      const i = order.indexOf(id);
      return i === -1 ? order.length : i;
    };
    keys = keys.map((k, i) => ({ k, i })).sort((a, b) => rank(a.k) - rank(b.k) || a.i - b.i).map(o => o.k);
  } else {
    for (const key of [...keys]) {
      const members = units.get(key);
      const arrow = members.length === 1 && members[0].type === 'arrow' ? members[0] : null;
      if (!arrow) continue;
      const endIndexes = [arrow.startBinding?.elementId, arrow.endBinding?.elementId]
        .map(id => entering.find(e => e.id === id))
        .filter(Boolean)
        .map(owner => keys.indexOf(unitKey(owner)));
      const at = keys.indexOf(key);
      const last = Math.max(-1, ...endIndexes);
      if (last > at) {
        // Removing the arrow shifts its later endpoint down by one, so
        // inserting at `last` places the arrow right after that endpoint.
        keys.splice(at, 1);
        keys.splice(last, 0, key);
      }
    }
  }
  return keys.map(k => units.get(k));
}

// Interpolate a shared element between keyframes.
function morphElement(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const out = { ...(t < 0.5 ? a : b) };
  for (const key of ['x', 'y', 'width', 'height', 'opacity', 'strokeWidth', 'fontSize']) {
    if (typeof a[key] === 'number' && typeof b[key] === 'number') out[key] = lerp(a[key], b[key], t);
  }
  if (typeof a.angle === 'number' && typeof b.angle === 'number') {
    let delta = (b.angle - a.angle) % (2 * Math.PI);
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    out.angle = a.angle + delta * t;
  }
  out.strokeColor = lerpColor(a.strokeColor, b.strokeColor, t);
  out.backgroundColor = lerpColor(a.backgroundColor, b.backgroundColor, t);
  if (Array.isArray(a.points) && Array.isArray(b.points) && a.points.length > 1 && b.points.length > 1) {
    out.points = lerpPoints(a.points, b.points, t);
  }
  // Changed text dips out and back in around the swap.
  if (a.type === 'text' && a.text !== b.text) {
    out.opacity = (out.opacity ?? 100) * Math.abs(1 - 2 * t);
  }
  return out;
}

// One entering element at progress p (0..1) of its own enter window.
function enterElement(el, style, p, ease) {
  const e = ease(p);
  const opacity = el.opacity ?? 100;
  if (style === 'none') return p > 0 ? [el] : [];
  if (style === 'fade') return [{ ...el, opacity: opacity * e }];
  if (style === 'rise') return [{ ...el, opacity: opacity * e, y: el.y + (1 - e) * 16 }];
  if (style === 'pop') {
    const s = 0.6 + 0.4 * EASINGS.outBack(p);
    const out = { ...el, opacity: opacity * clamp01(p * 3) };
    if (el.containerId || el.type === 'text') return [out];
    out.x = el.x + (el.width * (1 - s)) / 2;
    out.y = el.y + (el.height * (1 - s)) / 2;
    out.width = el.width * s;
    out.height = el.height * s;
    if (Array.isArray(el.points)) out.points = el.points.map(([px, py]) => [px * s, py * s]);
    return [out];
  }
  if (style === 'type' && el.type === 'text') {
    const full = el.originalText ?? el.text;
    const shown = full.slice(0, Math.round(full.length * p));
    return shown ? [{ ...el, text: shown, originalText: shown }] : [];
  }
  if (style === 'draw' && LINEAR_TYPES.has(el.type)) {
    if (p <= 0) return [];
    const drawn = { ...el, points: truncatePath(el.points, e), startBinding: null, endBinding: null };
    if (p < 1) drawn.elbowed = false;
    return [drawn];
  }
  if (style === 'draw' && OUTLINE_TYPES.has(el.type)) {
    // Trace the outline for the first 70%, then cross-fade to the real shape.
    if (p <= 0) return [];
    const trace = EASINGS.inOutCubic(clamp01(p / 0.7));
    const reveal = clamp01((p - 0.55) / 0.45);
    const parts = [];
    if (reveal > 0) parts.push({ ...el, opacity: opacity * reveal });
    if (reveal < 1) {
      parts.push({
        id: `${el.id}::trace`, type: 'line', x: el.x, y: el.y, width: el.width, height: el.height,
        angle: el.angle ?? 0, strokeColor: el.strokeColor, backgroundColor: 'transparent',
        strokeWidth: el.strokeWidth, strokeStyle: el.strokeStyle, roughness: el.roughness, seed: el.seed,
        opacity: opacity * (1 - reveal), roundness: el.type === 'ellipse' ? { type: 2 } : null,
        points: truncatePath(outlinePoints(el), trace), groupIds: [], boundElements: null,
      });
    }
    return parts;
  }
  // Labels and other elements without a dedicated style fade in.
  return [{ ...el, opacity: opacity * e }];
}

// Bookkeeping fields change on every save without changing the picture.
const BOOKKEEPING_KEYS = new Set(['version', 'versionNonce', 'updated', 'index']);
function visualKey(el) {
  return JSON.stringify(el, (key, value) => (BOOKKEEPING_KEYS.has(key) ? undefined : value));
}

// Plan one transition: when each element starts and how long it runs.
function planTransition(fromEls, toEls, spec) {
  const from = new Map(fromEls.map(el => [el.id, el]));
  const to = new Map(toEls.map(el => [el.id, el]));
  const entering = toEls.filter(el => !from.has(el.id));
  const exiting = fromEls.filter(el => !to.has(el.id));
  const morphing = toEls.filter(el => from.has(el.id) && visualKey(from.get(el.id)) !== visualKey(el));
  const duration = spec.duration ?? 0.8;
  const stagger = spec.stagger ?? 0.12;
  const enterDuration = spec.enterDuration ?? Math.min(0.7, Math.max(0.35, duration * 0.75));
  const busy = exiting.length > 0 || morphing.length > 0;
  const exitDuration = busy ? Math.min(duration, 0.45) : 0;
  const enterStart = busy ? Math.min(duration * 0.5, 0.4) : 0;
  const units = orderUnits(entering, spec.order);
  const timing = new Map();
  units.forEach((members, i) => {
    const start = enterStart + i * stagger;
    for (const el of members) {
      // A shape's label appears as its outline finishes.
      const isLabel = Boolean(el.containerId);
      const style = spec.styles?.[el.id] ?? (isLabel ? 'fade' : spec.enter && spec.enter !== 'auto' ? spec.enter : defaultEnterStyle(el));
      timing.set(el.id, {
        start: isLabel ? start + enterDuration * 0.5 : start,
        length: isLabel ? enterDuration * 0.5 : enterDuration,
        style,
      });
    }
  });
  const enterEnd = units.length ? enterStart + (units.length - 1) * stagger + enterDuration : 0;
  const total = Math.max(busy ? duration : 0, enterEnd, exitDuration);
  return { from, to, timing, exitDuration, total, morphDuration: morphing.length ? duration : 0 };
}

// Elements on screen at time `time` (seconds) into a planned transition.
function sampleTransition(plan, toEls, fromEls, time, ease) {
  const out = [];
  // Exiting elements keep their original z-order slot by staying in front of
  // nothing in particular: draw them first so entering content covers them.
  for (const el of fromEls) {
    if (plan.to.has(el.id)) continue;
    const p = windowProgress(time, 0, plan.exitDuration);
    if (p < 1) out.push({ ...el, opacity: (el.opacity ?? 100) * (1 - ease(p)) });
  }
  const morphT = ease(windowProgress(time, 0, plan.morphDuration));
  for (const el of toEls) {
    const before = plan.from.get(el.id);
    if (before) {
      out.push(morphElement(before, el, morphT));
      continue;
    }
    const { start, length, style } = plan.timing.get(el.id);
    const p = windowProgress(time, start, length);
    if (p > 0) out.push(...enterElement(el, style, p, ease));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rendering

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2147483646) + 1;
}

async function renderFrame(elements, camera, options, boilTick) {
  const seeded = boilTick === null ? elements : elements.map(el => ({ ...el, seed: hashSeed(`${el.id}:${boilTick}`) }));
  const live = await prepareScene(seeded);
  const [frame] = await prepareScene([{ id: '__camera', type: 'frame', name: '', ...camera }]);
  let svg = await renderSvgWithExcalidraw(live, options.files, {
    background: true,
    viewBackgroundColor: options.background,
    dark: options.dark,
    padding: 0,
    exportingFrame: frame,
  });
  const entries = fonts.collectFontEntriesFromSvg(svg);
  svg = fonts.rewriteFontFamilies(svg, entries);
  return svgToPng(svg, {
    scale: options.width / camera.width,
    fontFiles: fonts.fontFilesFor(entries),
    loadSystemFonts: fonts.needsSystemFonts(live),
    defaultFontFamily: 'Excalifont',
  }).data;
}

function encode(framesDir, options) {
  const { out, fps, width, height } = options;
  const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(framesDir, '%05d.png')];
  const fit = `scale=${width}:${height}:flags=lanczos`;
  const ext = path.extname(out).toLowerCase();
  let args;
  if (ext === '.mp4' || ext === '.mov') {
    args = [...input, '-vf', `${fit},format=yuv420p`, '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', out];
  } else if (ext === '.webm') {
    args = [...input, '-vf', fit, '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-pix_fmt', 'yuv420p', out];
  } else if (ext === '.gif') {
    const graph = `${fit},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
    args = [...input, '-filter_complex', graph, '-loop', '0', out];
  } else {
    fail(`unsupported output "${out}" (use .mp4, .mov, .webm, .gif, or a directory for PNG frames)`);
  }
  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (result.error) fail(`ffmpeg not runnable: ${result.error.message}`);
  if (result.status !== 0) fail(`ffmpeg exited with ${result.status}`);
}

// ---------------------------------------------------------------------------
// CLI

function parseCli(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--intro' || arg === '--dark') flags[arg.slice(2)] = true;
    else if (arg.startsWith('--')) flags[arg.slice(2)] = argv[++i];
    else positionals.push(arg);
  }
  return { flags, positionals };
}

function buildStoryboard(positionals, flags) {
  if (positionals.length === 1 && positionals[0].endsWith('.json') && !flags.scene) {
    const file = path.resolve(positionals[0]);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.keyframes) return { board: data, baseDir: path.dirname(file) };
  }
  const duration = flags.duration ? Number(flags.duration) : 0.8;
  const hold = flags.hold ? Number(flags.hold) : 1.2;
  return {
    board: {
      keyframes: positionals.map((scene, i) => ({
        scene,
        duration: i === 0 && !flags.intro ? 0 : duration,
        hold,
      })),
    },
    baseDir: process.cwd(),
  };
}

async function main() {
  const { flags, positionals } = parseCli(process.argv.slice(2));
  if (positionals.length === 0 || flags.help) {
    process.stdout.write(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).map(l => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
    process.exit(positionals.length === 0 ? 2 : 0);
  }
  const { board, baseDir } = buildStoryboard(positionals, flags);
  const options = {
    out: flags.out ? path.resolve(flags.out) : path.resolve(baseDir, board.output ?? 'animation.mp4'),
    fps: Number(flags.fps ?? board.fps ?? 30),
    width: Number(flags.width ?? board.width ?? 1920),
    height: Number(flags.height ?? board.height ?? 1080),
    background: board.background ?? '#ffffff',
    dark: Boolean(flags.dark ?? board.dark),
    boil: Number(flags.boil ?? board.boil ?? 0),
    padding: Number(flags.padding ?? board.padding ?? 60),
    files: {},
  };
  options.width -= options.width % 2;
  options.height -= options.height % 2;
  const aspect = options.width / options.height;
  const ease = easing(board.easing);

  const keyframes = [];
  for (const spec of board.keyframes) {
    const scene = await loadSceneSource(spec.scene, baseDir);
    Object.assign(options.files, scene.files);
    const elements = await normalizeKeyframe(expandShorthand(scene.elements));
    keyframes.push({ spec, elements });
  }

  // Default camera frames everything any keyframe shows; keyframes may
  // override it and later keyframes inherit the last camera.
  const everything = fitAspect(boundsOf(keyframes.flatMap(k => k.elements)), aspect, options.padding);
  let camera = board.camera ? resolveCamera(board.camera, keyframes.flatMap(k => k.elements), aspect, options.padding) : everything;
  for (const k of keyframes) {
    k.camera = resolveCamera(k.spec.camera, k.elements, aspect, options.padding) ?? camera;
    camera = k.camera;
  }

  const outIsDir = path.extname(options.out) === '';
  const framesDir = outIsDir ? options.out : fs.mkdtempSync(path.join(os.tmpdir(), 'excalidraw-animate-'));
  fs.mkdirSync(framesDir, { recursive: true });
  let frameIndex = 0;
  let lastPng = null;
  const writeFrame = png => {
    fs.writeFileSync(path.join(framesDir, `${String(++frameIndex).padStart(5, '0')}.png`), png);
    lastPng = png;
  };
  const boilTick = seconds => (options.boil > 0 ? Math.floor(seconds * options.boil) : null);
  let clock = 0;
  const started = performance.now();

  let previous = { elements: [], camera: keyframes[0].camera };
  for (const k of keyframes) {
    const plan = planTransition(previous.elements, k.elements, k.spec);
    const keyEase = k.spec.easing ? easing(k.spec.easing) : ease;
    const total = (k.spec.duration ?? 0.8) === 0 ? 0 : plan.total;
    const transitionFrames = Math.round(total * options.fps);
    for (let f = 1; f <= transitionFrames; f++) {
      const time = (f / transitionFrames) * total;
      const elements = sampleTransition(plan, k.elements, previous.elements, time, keyEase);
      const cam = lerpRect(previous.camera, k.camera, keyEase(windowProgress(time, 0, total)));
      writeFrame(await renderFrame(elements, cam, options, boilTick(clock + time)));
    }
    clock += total;
    const holdFrames = Math.max(Math.round((k.spec.hold ?? 1.2) * options.fps), transitionFrames === 0 ? 1 : 0);
    let tick = undefined;
    for (let f = 0; f < holdFrames; f++) {
      const nextTick = boilTick(clock + f / options.fps);
      // Static holds reuse one render; boiling re-renders when the seed changes.
      if (lastPng && nextTick === tick && f > 0) writeFrame(lastPng);
      else writeFrame(await renderFrame(k.elements, k.camera, options, nextTick));
      tick = nextTick;
    }
    clock += holdFrames / options.fps;
    previous = k;
  }

  if (!outIsDir) {
    encode(framesDir, options);
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
  const seconds = (performance.now() - started) / 1000;
  process.stdout.write(JSON.stringify({
    success: true, file: options.out, frames: frameIndex, duration: Number((frameIndex / options.fps).toFixed(2)),
    width: options.width, height: options.height, fps: options.fps, renderSeconds: Number(seconds.toFixed(1)),
  }) + '\n');
}

await main();

// ---------------------------------------------------------------------------
// Storyboard reference
//
// {
//   "output": "explainer.mp4",   // .mp4 .mov .webm .gif, or a directory for PNG frames
//   "width": 1920, "height": 1080, "fps": 30,
//   "background": "#ffffff", "dark": false,
//   "padding": 60,               // camera padding around content (scene units)
//   "boil": 0,                   // hand-drawn wobble: re-seed strokes N times per second
//   "easing": "inOutCubic",      // linear inCubic outCubic inOutCubic outBack
//   "camera": {...},             // optional global camera (see keyframe camera)
//   "keyframes": [
//     {
//       "scene": "step1.excalidraw",   // file (.excalidraw/.json/.excalidraw.md), "snapshot:<name>",
//                                      // "canvas" (live), or an inline element array
//       "duration": 0.8,     // transition into this keyframe; 0 = cut. First keyframe
//                            // animates in from empty unless duration is 0.
//       "hold": 1.5,         // seconds to rest on the finished keyframe
//       "stagger": 0.12,     // delay between successive entering elements
//       "enterDuration": 0.6,
//       "enter": "auto",     // auto | draw | pop | fade | rise | type | none
//       "styles": {"title": "type"},   // per-element enter style overrides
//       "order": ["db", "api"],        // explicit enter order (unit = element, label's
//                                      // container, or "group:<groupId>")
//       "camera": {"fit": ["api", "db"], "padding": 40}  // or {"x","y","width","height"}
//     }
//   ]
// }
//
// auto enter styles: arrows/lines/freedraw grow along their path, rectangles,
// ellipses and diamonds are traced then filled, text fades in.
