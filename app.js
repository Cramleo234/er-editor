'use strict';

/* ================= Konstanten ================= */

const SVGNS = 'http://www.w3.org/2000/svg';
const STORE_KEY = 'er-editor:diagram';
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const NAME_FONT = `500 14px ${FONT_STACK}`;
const LABEL_FONT = `600 13px ${FONT_STACK}`;

const TYPES = { entity: 'Entity', relationship: 'Beziehung', attribute: 'Attribut' };
const LABEL_PRESETS = ['1', 'N', 'M', '0..1', '1..*', '0..*', '(1,1)', '(0,n)'];

const FLAGS = {
  entity: [['weak', 'Schwache Entity', 'Doppelter Rahmen']],
  relationship: [['weak', 'Identifizierende Beziehung', 'Doppelte Raute']],
  attribute: [
    ['key', 'Schlüsselattribut', 'Name unterstrichen'],
    ['partial', 'Partieller Schlüssel', 'Gestrichelt unterstrichen'],
    ['multi', 'Mehrwertig', 'Doppelte Ellipse'],
    ['derived', 'Abgeleitet', 'Gestrichelte Ellipse'],
  ],
  edge: [['total', 'Totale Teilnahme', 'Doppelte Linie']],
};

const HINTS = {
  select: 'Ziehen zum Verschieben · Doppelklick zum Umbenennen · Hintergrund ziehen verschiebt die Ansicht',
  entity: 'Klicke auf die Fläche, um eine Entity zu platzieren (⇧ hält das Werkzeug)',
  relationship: 'Klicke auf die Fläche, um eine Beziehung zu platzieren (⇧ hält das Werkzeug)',
  attribute: 'Klicke auf die Fläche – ist ein Element ausgewählt, wird das Attribut direkt verbunden (⇧ für mehrere)',
  key: 'Klicke auf die Fläche – ist ein Element ausgewählt, wird der Schlüssel direkt verbunden',
  connect: 'Quelle anklicken, dann Ziel anklicken – oder von Element zu Element ziehen',
  connectTarget: 'Jetzt das Ziel anklicken · Esc bricht ab',
};

// Diagramm-Styles: werden in die Zeichenfläche UND in exportierte SVG/PNG eingebettet.
const DIAGRAM_CSS = `
text{font:${NAME_FONT};fill:#1f2430;text-anchor:middle;dominant-baseline:central}
.shape{stroke-width:1.6}
.entity .shape{fill:#e8efff;stroke:#3355c4}
.relationship .shape{fill:#fff2dc;stroke:#c97a1c}
.attribute .shape{fill:#ffffff;stroke:#5b6475}
.attribute.key .shape{fill:#effaf2;stroke:#2f8a4b}
.dashed{stroke-dasharray:5 4}
.underline{stroke:#1f2430;stroke-width:1.3}
.underline.dashed{stroke-dasharray:4 3}
.edge .stroke{stroke:#4a5263;stroke-width:1.6}
.edge .hit{stroke:transparent;stroke-width:14}
.label-bg{fill:#ffffff;stroke:#c9ced8;stroke-width:1}
.label{font:${LABEL_FONT}}
.selected .shape,.selected .stroke{stroke:#6741d9;stroke-width:2.6}
.selected .label-bg{stroke:#6741d9;stroke-width:1.6}
.source .shape{stroke:#6741d9;stroke-width:2.6;stroke-dasharray:5 3}
`;

/* ================= DOM ================= */

const $ = (s, root = document) => root.querySelector(s);
const svg = $('#canvas');
const viewport = $('#viewport');
const gEdges = $('#edges');
const gNodes = $('#nodes');
const rubber = $('#rubber');
const panel = $('#panel');
const hint = $('#hint');
const inline = $('#inline');
const fileInput = $('#file');
const titleInput = $('#title');

const styleEl = document.createElementNS(SVGNS, 'style');
styleEl.textContent = DIAGRAM_CSS;
svg.prepend(styleEl);

/* ================= Zustand ================= */

let state = { title: 'Unbenanntes Diagramm', nodes: [], edges: [] };
let nextId = 1;
let view = { x: 0, y: 0, k: 1 };
let tool = 'select';
let selected = null;        // { kind: 'node' | 'edge', id }
let connectFrom = null;     // Knoten-ID beim Verbinden
let drag = null;            // laufende Zieh-Aktion
let editing = null;         // Inline-Editor
let lastDown = null;        // für Doppelklick-Erkennung
let spaceDown = false;
let undoStack = [];
let redoStack = [];

const snapshot = () => JSON.stringify(state);

function commit(before) {
  if (before === snapshot()) return;
  undoStack.push(before);
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
  save();
  updateButtons();
}

function restore(json) {
  state = JSON.parse(json);
  nextId = Math.max(0, ...state.nodes.map(n => n.id), ...state.edges.map(e => e.id)) + 1;
  if (selected && !findSelected()) selected = null;
  connectFrom = null;
  titleInput.value = state.title || '';
  render();
  renderPanel();
  save();
  updateButtons();
}

function undo() {
  endEdit(false);
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}

function redo() {
  endEdit(false);
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, view })); } catch { /* egal */ }
}

/* ================= Geometrie ================= */

const measureCtx = document.createElement('canvas').getContext('2d');
function textWidth(text, font = NAME_FONT) {
  measureCtx.font = font;
  return measureCtx.measureText(text || ' ').width;
}

function nodeSize(n) {
  const tw = textWidth(n.name);
  if (n.type === 'entity') return { w: Math.max(110, tw + 40), h: 52 };
  if (n.type === 'relationship') return { w: Math.max(130, tw * 1.35 + 50), h: 76 };
  return { w: Math.max(96, tw + 46), h: 46 };
}

// Schnittpunkt der Linie Mittelpunkt -> (tx,ty) mit dem Umriss des Knotens
function borderPoint(n, tx, ty) {
  const { w, h } = nodeSize(n);
  const hw = w / 2, hh = h / 2;
  const dx = tx - n.x, dy = ty - n.y;
  if (!dx && !dy) return { x: n.x, y: n.y };
  let t;
  if (n.type === 'entity') t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  else if (n.type === 'relationship') t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  else t = 1 / Math.hypot(dx / hw, dy / hh);
  t = Math.min(t, 1);
  return { x: n.x + dx * t, y: n.y + dy * t };
}

function edgeGeometry(e) {
  const a = nodeById(e.from), b = nodeById(e.to);
  if (!a || !b) return null;
  const p = borderPoint(a, b.x, b.y);
  const q = borderPoint(b, a.x, a.y);
  return { p, q, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 };
}

function bounds(pad = 0) {
  if (!state.nodes.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of state.nodes) {
    const { w, h } = nodeSize(n);
    x1 = Math.min(x1, n.x - w / 2); y1 = Math.min(y1, n.y - h / 2);
    x2 = Math.max(x2, n.x + w / 2); y2 = Math.max(y2, n.y + h / 2);
  }
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + 2 * pad, h: y2 - y1 + 2 * pad };
}

const diamond = (hw, hh) => `0,${-hh} ${hw},0 0,${hh} ${-hw},0`;

/* ================= Abfragen ================= */

const nodeById = id => state.nodes.find(n => n.id === id);
const edgeById = id => state.edges.find(e => e.id === id);
const findSelected = () => selected && (selected.kind === 'node' ? nodeById(selected.id) : edgeById(selected.id));
const isSelected = (kind, id) => selected && selected.kind === kind && selected.id === id;

/* ================= Rendering ================= */

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function render() {
  gEdges.textContent = '';
  gNodes.textContent = '';
  for (const e of state.edges) drawEdge(e);
  for (const n of state.nodes) drawNode(n);
}

function drawEdge(e) {
  const geo = edgeGeometry(e);
  if (!geo) return;
  const { p, q, mx, my } = geo;
  const g = el('g', { class: 'edge' + (isSelected('edge', e.id) ? ' selected' : ''), 'data-edge': e.id }, gEdges);
  el('line', { class: 'hit', x1: p.x, y1: p.y, x2: q.x, y2: q.y }, g);
  if (e.total) {
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const ox = -(q.y - p.y) / len * 2.4, oy = (q.x - p.x) / len * 2.4;
    for (const s of [1, -1]) {
      el('line', { class: 'stroke', x1: p.x + ox * s, y1: p.y + oy * s, x2: q.x + ox * s, y2: q.y + oy * s }, g);
    }
  } else {
    el('line', { class: 'stroke', x1: p.x, y1: p.y, x2: q.x, y2: q.y }, g);
  }
  if (e.label) {
    const w = textWidth(e.label, LABEL_FONT) + 14;
    el('rect', { class: 'label-bg', x: mx - w / 2, y: my - 11, width: w, height: 22, rx: 5 }, g);
    el('text', { class: 'label', x: mx, y: my }, g).textContent = e.label;
  }
}

function drawNode(n) {
  const { w, h } = nodeSize(n);
  const hw = w / 2, hh = h / 2;
  const cls = ['node', n.type];
  if (n.type === 'attribute' && (n.key || n.partial)) cls.push('key');
  if (isSelected('node', n.id)) cls.push('selected');
  if (connectFrom === n.id) cls.push('source');
  const g = el('g', { class: cls.join(' '), 'data-node': n.id, transform: `translate(${n.x} ${n.y})` }, gNodes);

  if (n.type === 'entity') {
    el('rect', { class: 'shape', x: -hw, y: -hh, width: w, height: h, rx: 3 }, g);
    if (n.weak) el('rect', { class: 'shape', x: -hw + 5, y: -hh + 5, width: w - 10, height: h - 10, rx: 2 }, g);
  } else if (n.type === 'relationship') {
    el('polygon', { class: 'shape', points: diamond(hw, hh) }, g);
    if (n.weak) el('polygon', { class: 'shape', points: diamond(hw - 12, hh - 7) }, g);
  } else {
    const dash = n.derived ? ' dashed' : '';
    el('ellipse', { class: 'shape' + dash, rx: hw, ry: hh }, g);
    if (n.multi) el('ellipse', { class: 'shape' + dash, rx: hw - 5, ry: hh - 5 }, g);
  }

  el('text', { x: 0, y: 0 }, g).textContent = n.name || ' ';

  if (n.type === 'attribute' && (n.key || n.partial)) {
    const tw = textWidth(n.name);
    el('line', { class: 'underline' + (n.partial && !n.key ? ' dashed' : ''), x1: -tw / 2, x2: tw / 2, y1: 10, y2: 10 }, g);
  }
}

function applyView() {
  viewport.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  const s = 22 * view.k;
  svg.style.backgroundSize = `${s}px ${s}px`;
  svg.style.backgroundPosition = `${view.x}px ${view.y}px`;
  $('#zoom-label').textContent = Math.round(view.k * 100) + ' %';
}

let saveViewTimer;
function viewChanged() {
  applyView();
  if (editing) positionInline();
  clearTimeout(saveViewTimer);
  saveViewTimer = setTimeout(save, 300);
}

/* ================= Werkzeuge & Hinweise ================= */

function setTool(t) {
  endEdit(false);
  tool = t;
  connectFrom = null;
  rubber.setAttribute('visibility', 'hidden');
  svg.dataset.tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => {
    if (b !== svg) b.setAttribute('aria-pressed', String(b.dataset.tool === t));
  });
  updateHint();
  render();
}

function updateHint() {
  hint.textContent = tool === 'connect' && connectFrom != null ? HINTS.connectTarget : HINTS[tool];
}

function updateButtons() {
  $('[data-cmd="undo"]').disabled = !undoStack.length;
  $('[data-cmd="redo"]').disabled = !redoStack.length;
  $('[data-cmd="delete"]').disabled = !selected;
}

function select(sel) {
  selected = sel;
  render();
  renderPanel();
  updateButtons();
}

/* ================= Mutationen ================= */

function createNode(type, p, keepTool) {
  const before = snapshot();
  const anchor = selected && selected.kind === 'node' ? nodeById(selected.id) : null;
  const n = {
    id: nextId++,
    type: type === 'key' ? 'attribute' : type,
    x: Math.round(p.x),
    y: Math.round(p.y),
    name: type === 'key' ? 'ID' : TYPES[type],
  };
  if (type === 'key') n.key = true;
  state.nodes.push(n);
  if (n.type === 'attribute' && anchor) {
    state.edges.push({ id: nextId++, from: anchor.id, to: n.id, label: '' });
  }
  commit(before);
  if (keepTool) {
    render();
    return;
  }
  setTool('select');
  select({ kind: 'node', id: n.id });
  startEdit('node', n.id);
}

function addEdge(from, to) {
  if (from === to) return;
  const exists = state.edges.some(e => (e.from === from && e.to === to) || (e.from === to && e.to === from));
  if (exists) { flashHint('Diese Elemente sind bereits verbunden.'); return; }
  const before = snapshot();
  const e = { id: nextId++, from, to, label: '' };
  state.edges.push(e);
  commit(before);
  connectFrom = null;
  rubber.setAttribute('visibility', 'hidden');
  updateHint();
  select({ kind: 'edge', id: e.id });
}

function deleteSelected() {
  if (!selected) return;
  const before = snapshot();
  if (selected.kind === 'node') {
    state.nodes = state.nodes.filter(n => n.id !== selected.id);
    state.edges = state.edges.filter(e => e.from !== selected.id && e.to !== selected.id);
  } else {
    state.edges = state.edges.filter(e => e.id !== selected.id);
  }
  commit(before);
  select(null);
}

let hintTimer;
function flashHint(text) {
  hint.textContent = text;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(updateHint, 2200);
}

/* ================= Inline-Editor ================= */

function startEdit(kind, id) {
  endEdit(false);
  const obj = kind === 'node' ? nodeById(id) : edgeById(id);
  if (!obj) return;
  editing = { kind, id, before: snapshot(), t: performance.now() };
  inline.value = kind === 'node' ? obj.name : (obj.label || '');
  inline.placeholder = kind === 'node' ? 'Name' : 'Beschriftung, z. B. 1 oder N';
  inline.hidden = false;
  positionInline();
  // erst nach dem aktuellen Mausklick fokussieren, sonst nimmt die Zeichenfläche den Fokus wieder
  setTimeout(() => { if (editing) { inline.focus(); inline.select(); } }, 0);
}

function positionInline() {
  const obj = editing.kind === 'node' ? nodeById(editing.id) : edgeById(editing.id);
  if (!obj) return;
  const r = svg.getBoundingClientRect();
  let x, y, w;
  if (editing.kind === 'node') {
    x = obj.x; y = obj.y; w = nodeSize(obj).w * view.k * 0.9;
  } else {
    const geo = edgeGeometry(obj);
    x = geo.mx; y = geo.my; w = 140;
  }
  inline.style.left = r.left + view.x + x * view.k + 'px';
  inline.style.top = r.top + view.y + y * view.k + 'px';
  inline.style.width = Math.max(120, w) + 'px';
}

function endEdit(cancel) {
  if (!editing) return;
  const e = editing;
  editing = null;
  inline.hidden = true;
  if (cancel) state = JSON.parse(e.before);
  else commit(e.before);
  render();
  renderPanel();
}

inline.addEventListener('input', () => {
  if (!editing) return;
  const obj = editing.kind === 'node' ? nodeById(editing.id) : edgeById(editing.id);
  if (!obj) return;
  if (editing.kind === 'node') obj.name = inline.value;
  else obj.label = inline.value;
  render();
  positionInline();
});
inline.addEventListener('keydown', ev => {
  if (ev.key === 'Enter') { ev.preventDefault(); endEdit(false); }
  if (ev.key === 'Escape') { ev.preventDefault(); endEdit(true); }
  ev.stopPropagation();
});
inline.addEventListener('blur', () => endEdit(false));
// Der Rest des Doppelklicks landet auf dem frisch geöffneten Feld – Markierung erhalten
for (const type of ['mouseup', 'click', 'dblclick']) {
  inline.addEventListener(type, ev => {
    if (editing && performance.now() - editing.t < 700) { ev.preventDefault(); inline.select(); }
  });
}

/* ================= Zeiger-Interaktion ================= */

function toWorld(ev) {
  const r = svg.getBoundingClientRect();
  return { x: (ev.clientX - r.left - view.x) / view.k, y: (ev.clientY - r.top - view.y) / view.k };
}

function isDoubleClick(kind, id) {
  const now = performance.now();
  const dbl = lastDown && lastDown.kind === kind && lastDown.id === id && now - lastDown.t < 400;
  lastDown = dbl ? null : { kind, id, t: now };
  return dbl;
}

svg.addEventListener('pointerdown', ev => {
  ev.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  endEdit(false);
  const nodeEl = ev.target.closest('[data-node]');
  const edgeEl = ev.target.closest('[data-edge]');
  const p = toWorld(ev);

  // Ansicht verschieben: mittlere Taste, Leertaste+Ziehen oder Hintergrund im Auswahlmodus
  const panGesture = ev.button === 1 || (ev.button === 0 && spaceDown);
  if (panGesture) { startPan(ev); return; }
  if (ev.button !== 0) return;

  if (tool === 'connect') {
    if (nodeEl) {
      const id = +nodeEl.dataset.node;
      if (connectFrom == null) {
        connectFrom = id;
        drag = { type: 'connect', id };
        updateRubber(p);
        updateHint();
        render();
      } else {
        addEdge(connectFrom, id);
      }
    } else {
      connectFrom = null;
      rubber.setAttribute('visibility', 'hidden');
      updateHint();
      render();
      if (!edgeEl) startPan(ev);
    }
    return;
  }

  if (tool !== 'select' && !nodeEl && !edgeEl) {
    createNode(tool, p, ev.shiftKey);
    return;
  }

  if (nodeEl) {
    const id = +nodeEl.dataset.node;
    if (isDoubleClick('node', id)) { select({ kind: 'node', id }); startEdit('node', id); return; }
    const n = nodeById(id);
    if (tool !== 'select') setTool('select');
    select({ kind: 'node', id });
    drag = { type: 'node', id, ox: p.x - n.x, oy: p.y - n.y, before: snapshot(), moved: false };
    svg.setPointerCapture(ev.pointerId);
    return;
  }

  if (edgeEl) {
    const id = +edgeEl.dataset.edge;
    if (tool !== 'select') setTool('select');
    select({ kind: 'edge', id });
    if (isDoubleClick('edge', id)) startEdit('edge', id);
    return;
  }

  lastDown = null;
  select(null);
  startPan(ev);
});

function startPan(ev) {
  drag = { type: 'pan', sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y };
  svg.classList.add('panning');
  svg.setPointerCapture(ev.pointerId);
}

function updateRubber(p) {
  const a = nodeById(connectFrom);
  if (!a) return;
  const s = borderPoint(a, p.x, p.y);
  rubber.setAttribute('x1', s.x); rubber.setAttribute('y1', s.y);
  rubber.setAttribute('x2', p.x); rubber.setAttribute('y2', p.y);
  rubber.setAttribute('visibility', 'visible');
}

svg.addEventListener('pointermove', ev => {
  const p = toWorld(ev);
  if (tool === 'connect' && connectFrom != null) updateRubber(p);
  if (!drag) return;
  if (drag.type === 'pan') {
    view.x = drag.vx + ev.clientX - drag.sx;
    view.y = drag.vy + ev.clientY - drag.sy;
    viewChanged();
  } else if (drag.type === 'node') {
    const n = nodeById(drag.id);
    n.x = Math.round(p.x - drag.ox);
    n.y = Math.round(p.y - drag.oy);
    drag.moved = true;
    lastDown = null;
    render();
  }
});

svg.addEventListener('pointerup', ev => {
  if (!drag) return;
  if (drag.type === 'node' && drag.moved) commit(drag.before);
  if (drag.type === 'connect') {
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-node]');
    if (target && +target.dataset.node !== drag.id) addEdge(drag.id, +target.dataset.node);
  }
  svg.classList.remove('panning');
  drag = null;
});
svg.addEventListener('pointercancel', () => { drag = null; svg.classList.remove('panning'); });

// Scrollen = Ansicht verschieben, Strg/⌘ + Scrollen bzw. Pinch = Zoomen
svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  if (ev.ctrlKey || ev.metaKey) {
    const r = svg.getBoundingClientRect();
    zoomAt(Math.exp(-ev.deltaY * 0.01), ev.clientX - r.left, ev.clientY - r.top);
  } else {
    view.x -= ev.deltaX;
    view.y -= ev.deltaY;
    viewChanged();
  }
}, { passive: false });

function zoomAt(factor, sx, sy) {
  const k = Math.min(3, Math.max(0.2, view.k * factor));
  view.x = sx - (sx - view.x) * (k / view.k);
  view.y = sy - (sy - view.y) * (k / view.k);
  view.k = k;
  viewChanged();
}

function zoomCenter(factor) {
  const r = svg.getBoundingClientRect();
  zoomAt(factor, r.width / 2, r.height / 2);
}

function fit() {
  const b = bounds(40);
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) {
    // Zeichenfläche noch nicht sichtbar: einpassen, sobald sie eine Größe hat
    const ro = new ResizeObserver(() => {
      if (svg.clientWidth && svg.clientHeight) { ro.disconnect(); fit(); }
    });
    ro.observe(svg);
    return;
  }
  if (!b) { view = { x: r.width / 2, y: r.height / 2, k: 1 }; viewChanged(); return; }
  const k = Math.max(0.2, Math.min(1.5, r.width / b.w, r.height / b.h));
  view = { k, x: r.width / 2 - (b.x + b.w / 2) * k, y: r.height / 2 - (b.y + b.h / 2) * k };
  viewChanged();
}

/* ================= Tastatur ================= */

document.addEventListener('keydown', ev => {
  if (ev.target.matches('input, select, textarea')) return;
  const mod = ev.metaKey || ev.ctrlKey;
  const key = ev.key.toLowerCase();

  if (mod && key === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
  if (mod && key === 'y') { ev.preventDefault(); redo(); return; }
  if (mod && key === 's') { ev.preventDefault(); saveJSON(); return; }
  if (mod) return;

  if (ev.key === ' ') { spaceDown = true; ev.preventDefault(); return; }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); deleteSelected(); return; }
  if (ev.key === 'Escape') { setTool('select'); select(null); return; }
  if (ev.key === 'Enter' && selected) { ev.preventDefault(); startEdit(selected.kind, selected.id); return; }

  if (ev.key.startsWith('Arrow') && selected?.kind === 'node') {
    ev.preventDefault();
    const n = nodeById(selected.id);
    const step = ev.shiftKey ? 10 : 1;
    const before = snapshot();
    if (ev.key === 'ArrowLeft') n.x -= step;
    if (ev.key === 'ArrowRight') n.x += step;
    if (ev.key === 'ArrowUp') n.y -= step;
    if (ev.key === 'ArrowDown') n.y += step;
    commit(before);
    render();
    return;
  }

  const tools = { v: 'select', e: 'entity', r: 'relationship', a: 'attribute', k: 'key', c: 'connect' };
  if (tools[key]) setTool(tools[key]);
  if (key === 'f') fit();
  if (key === '+' || key === '=') zoomCenter(1.2);
  if (key === '-') zoomCenter(1 / 1.2);
});

document.addEventListener('keyup', ev => { if (ev.key === ' ') spaceDown = false; });
window.addEventListener('blur', () => { spaceDown = false; });

/* ================= Eigenschaften-Panel ================= */

const HELP_HTML = `
  <div class="help">
    <h2>ER-Editor</h2>
    <p>Wähle ein Werkzeug und klicke auf die Fläche. Doppelklick auf ein Element oder eine Kante zum Beschriften.</p>
    <p>Tipp: Erst eine Entity auswählen, dann <kbd>A</kbd> oder <kbd>K</kbd> drücken und klicken – das Attribut wird direkt verbunden.</p>
    <h2>Tastenkürzel</h2>
    <ul>
      <li>Auswahl <kbd>V</kbd></li>
      <li>Entity <kbd>E</kbd></li>
      <li>Beziehung <kbd>R</kbd></li>
      <li>Attribut <kbd>A</kbd></li>
      <li>Schlüssel <kbd>K</kbd></li>
      <li>Kante <kbd>C</kbd></li>
      <li>Umbenennen <kbd>Enter</kbd></li>
      <li>Löschen <kbd>Entf</kbd></li>
      <li>Rückgängig <kbd>⌘/Strg Z</kbd></li>
      <li>Alles einpassen <kbd>F</kbd></li>
      <li>Ansicht ziehen <kbd>Leertaste</kbd></li>
      <li>Zoomen <kbd>⌘/Strg Scroll</kbd></li>
    </ul>
  </div>`;

let panelBefore = null;

function renderPanel() {
  const obj = findSelected();
  if (!obj) { panel.innerHTML = HELP_HTML; return; }

  const isNode = selected.kind === 'node';
  const flags = FLAGS[isNode ? obj.type : 'edge'];
  const flagHTML = flags.map(([prop, label, sub]) => `
    <label class="check"><input type="checkbox" data-flag="${prop}">
      <span>${label}<small>${sub}</small></span></label>`).join('');

  if (isNode) {
    const degree = state.edges.filter(e => e.from === obj.id || e.to === obj.id).length;
    panel.innerHTML = `
      <h2>${TYPES[obj.type]}</h2>
      <label class="field"><span>Name</span><input type="text" data-text="name" autocomplete="off"></label>
      <label class="field"><span>Typ</span><select data-type>
        ${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select></label>
      ${flagHTML}
      <div class="info">${degree} ${degree === 1 ? 'Verbindung' : 'Verbindungen'}</div>
      <button class="danger" data-action="delete">Löschen</button>`;
    $('[data-type]', panel).value = obj.type;
  } else {
    panel.innerHTML = `
      <h2>Kante</h2>
      <label class="field"><span>Beschriftung</span><input type="text" data-text="label" autocomplete="off" placeholder="z. B. 1, N, (0,n)"></label>
      <div class="presets">
        ${LABEL_PRESETS.map(l => `<button data-preset="${l}" aria-pressed="${obj.label === l}">${l}</button>`).join('')}
        <button data-preset="" title="Beschriftung entfernen">✕</button>
      </div>
      ${flagHTML}
      <div class="info"><span data-ends></span></div>
      <button class="danger" data-action="delete">Löschen</button>`;
    const a = nodeById(obj.from), b = nodeById(obj.to);
    $('[data-ends]', panel).textContent = `${a?.name || '?'}  —  ${b?.name || '?'}`;
  }

  const textInput = $('[data-text]', panel);
  textInput.value = obj[textInput.dataset.text] || '';
  panel.querySelectorAll('[data-flag]').forEach(c => { c.checked = !!obj[c.dataset.flag]; });
}

panel.addEventListener('focusin', ev => {
  if (ev.target.matches('[data-text]')) panelBefore = snapshot();
});
panel.addEventListener('focusout', ev => {
  if (ev.target.matches('[data-text]') && panelBefore) { commit(panelBefore); panelBefore = null; }
});
panel.addEventListener('input', ev => {
  const obj = findSelected();
  if (!obj || !ev.target.matches('[data-text]')) return;
  obj[ev.target.dataset.text] = ev.target.value;
  render();
});
panel.addEventListener('keydown', ev => {
  if (ev.target.matches('[data-text]') && (ev.key === 'Enter' || ev.key === 'Escape')) ev.target.blur();
});

panel.addEventListener('change', ev => {
  const obj = findSelected();
  if (!obj) return;
  const t = ev.target;
  const before = snapshot();
  if (t.matches('[data-flag]')) {
    obj[t.dataset.flag] = t.checked;
    if (t.dataset.flag === 'key' && t.checked) obj.partial = false;
    if (t.dataset.flag === 'partial' && t.checked) obj.key = false;
  } else if (t.matches('[data-type]')) {
    obj.type = t.value;
    for (const f of ['weak', 'key', 'partial', 'multi', 'derived']) delete obj[f];
  } else {
    return;
  }
  commit(before);
  render();
  renderPanel();
});

panel.addEventListener('click', ev => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  if (btn.dataset.action === 'delete') { deleteSelected(); return; }
  if ('preset' in btn.dataset) {
    const e = findSelected();
    const before = snapshot();
    e.label = btn.dataset.preset;
    commit(before);
    render();
    renderPanel();
  }
});

titleInput.addEventListener('focus', () => { panelBefore = snapshot(); });
titleInput.addEventListener('input', () => { state.title = titleInput.value; });
titleInput.addEventListener('blur', () => { if (panelBefore) commit(panelBefore); panelBefore = null; });
titleInput.addEventListener('keydown', ev => { if (ev.key === 'Enter') titleInput.blur(); });

/* ================= Datei: Neu / Öffnen / Speichern / Export ================= */

function fileBase() {
  return (state.title || 'diagramm').trim().replace(/[^\wäöüÄÖÜß.-]+/g, '_') || 'diagramm';
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function saveJSON() {
  const data = { format: 'er-editor', version: 1, ...state };
  download(fileBase() + '.json', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}

function loadData(data) {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('Kein gültiges ER-Diagramm.');
  const nodes = data.nodes
    .filter(n => n && Number.isFinite(n.id) && TYPES[n.type])
    .map(n => ({ ...n, x: +n.x || 0, y: +n.y || 0, name: String(n.name ?? '') }));
  const ids = new Set(nodes.map(n => n.id));
  const edges = data.edges
    .filter(e => e && Number.isFinite(e.id) && ids.has(e.from) && ids.has(e.to))
    .map(e => ({ ...e, label: String(e.label ?? '') }));
  return { title: String(data.title || 'Unbenanntes Diagramm'), nodes, edges };
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const loaded = loadData(JSON.parse(await file.text()));
    const before = snapshot();
    selected = null;
    restore(JSON.stringify(loaded));
    commit(before);
    fit();
  } catch (err) {
    alert('Datei konnte nicht geladen werden: ' + err.message);
  }
});

function exportSVGMarkup() {
  const sel = selected, src = connectFrom;
  selected = null; connectFrom = null;
  render();
  const b = bounds(30) || { x: 0, y: 0, w: 100, h: 100 };
  const markup =
    `<svg xmlns="${SVGNS}" width="${Math.ceil(b.w)}" height="${Math.ceil(b.h)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">` +
    `<style>${DIAGRAM_CSS}</style>` +
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ffffff"/>` +
    gEdges.outerHTML + gNodes.outerHTML + '</svg>';
  selected = sel; connectFrom = src;
  render();
  return { markup, b };
}

function exportSVG() {
  const { markup } = exportSVGMarkup();
  download(fileBase() + '.svg', new Blob([markup], { type: 'image/svg+xml' }));
}

function exportPNG() {
  const { markup, b } = exportSVGMarkup();
  const scale = 2;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(b.w * scale);
    c.height = Math.ceil(b.h * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, b.w, b.h);
    c.toBlob(blob => download(fileBase() + '.png', blob), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
}

function newDiagram() {
  if (state.nodes.length && !confirm('Aktuelles Diagramm leeren? (Lässt sich mit Rückgängig wiederherstellen.)')) return;
  const before = snapshot();
  state = { title: 'Unbenanntes Diagramm', nodes: [], edges: [] };
  titleInput.value = state.title;
  selected = null;
  commit(before);
  render();
  renderPanel();
  fit();
}

/* ================= Toolbar ================= */

const COMMANDS = {
  undo, redo,
  delete: deleteSelected,
  new: newDiagram,
  open: () => fileInput.click(),
  save: saveJSON,
  svg: exportSVG,
  png: exportPNG,
  'zoom-in': () => zoomCenter(1.2),
  'zoom-out': () => zoomCenter(1 / 1.2),
  'zoom-reset': () => { const r = svg.getBoundingClientRect(); zoomAt(1 / view.k, r.width / 2, r.height / 2); },
  fit,
};

document.addEventListener('click', ev => {
  const btn = ev.target.closest('button');
  if (!btn || panel.contains(btn)) return;
  if (btn.dataset.tool) setTool(btn.dataset.tool);
  if (btn.dataset.cmd) COMMANDS[btn.dataset.cmd]();
});

/* ================= Beispiel & Start ================= */

function sampleDiagram() {
  const nodes = [
    { id: 1, type: 'entity', x: 260, y: 300, name: 'Student' },
    { id: 2, type: 'relationship', x: 520, y: 300, name: 'besucht' },
    { id: 3, type: 'entity', x: 780, y: 300, name: 'Kurs' },
    { id: 4, type: 'attribute', x: 130, y: 180, name: 'MatrNr', key: true },
    { id: 5, type: 'attribute', x: 270, y: 150, name: 'Name' },
    { id: 6, type: 'attribute', x: 130, y: 420, name: 'Semester' },
    { id: 7, type: 'attribute', x: 520, y: 170, name: 'Note' },
    { id: 8, type: 'attribute', x: 780, y: 160, name: 'KursNr', key: true },
    { id: 9, type: 'attribute', x: 920, y: 220, name: 'Titel' },
    { id: 10, type: 'attribute', x: 920, y: 400, name: 'Teilnehmer', derived: true },
  ];
  const edges = [
    { id: 11, from: 1, to: 2, label: 'N' },
    { id: 12, from: 2, to: 3, label: 'M', total: true },
    { id: 13, from: 1, to: 4, label: '' },
    { id: 14, from: 1, to: 5, label: '' },
    { id: 15, from: 1, to: 6, label: '' },
    { id: 16, from: 2, to: 7, label: '' },
    { id: 17, from: 3, to: 8, label: '' },
    { id: 18, from: 3, to: 9, label: '' },
    { id: 19, from: 3, to: 10, label: '' },
  ];
  return { title: 'Hochschule', nodes, edges };
}

function init() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { /* egal */ }
  let data;
  try { data = stored ? loadData(stored) : sampleDiagram(); } catch { data = sampleDiagram(); }
  state = data;
  nextId = Math.max(0, ...state.nodes.map(n => n.id), ...state.edges.map(e => e.id)) + 1;
  titleInput.value = state.title;
  setTool('select');
  renderPanel();
  updateButtons();
  if (stored && stored.view && Number.isFinite(stored.view.k)) {
    view = { x: +stored.view.x || 0, y: +stored.view.y || 0, k: stored.view.k };
    applyView();
  } else {
    fit();
  }
}

init();
