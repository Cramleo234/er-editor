'use strict';

/* ================= Konstanten ================= */

const SVGNS = 'http://www.w3.org/2000/svg';
const STORE_KEY = 'er-editor:diagram';
const PREFS_KEY = 'er-editor:prefs';
const CLIP_KEY = 'er-editor:clipboard';
const MIGRATED_KEY = 'er-editor:migrated';
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const NAME_FONT = `500 14px ${FONT_STACK}`;
const LABEL_FONT = `600 13px ${FONT_STACK}`;
const PILL_FONT = `600 12px ${FONT_STACK}`;
const GRID = 11;  // Einrastraster: halber Abstand der Hintergrundpunkte
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
// In der Mac-App stellt die native Hülle einen Nachrichtenkanal bereit
const NATIVE = Boolean(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.er);

const TYPES = { entity: 'Entity', relationship: 'Beziehung', attribute: 'Attribut' };
const LABEL_PRESETS = ['1', 'N', 'M', '(0,1)', '(1,1)', '(0,n)', '(1,n)'];

// Min-Max-Angaben einheitlich als (min,max): "0..1", "1..*", "1,n", "( 0 ; N )" -> "(0,1)", "(1,n)", "(0,n)"
const MINMAX = /^\s*\(?\s*(\d+|[a-z*])\s*(?:,|;|\.\.)\s*(\d+|[a-z*])\s*\)?\s*$/i;
function normalizeLabel(label) {
  const m = MINMAX.exec(label || '');
  if (!m) return (label || '').trim();
  const part = v => (v === '*' ? 'n' : v.toLowerCase());
  return `(${part(m[1])},${part(m[2])})`;
}

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

// Schnell-Hinzufügen am Element: [Typ, Beschriftung]
const QUICK = {
  entity: [['attribute', '+ Attribut'], ['key', '+ Schlüssel'], ['relationship', '+ Beziehung']],
  relationship: [['entity', '+ Entity'], ['attribute', '+ Attribut']],
  attribute: [['attribute', '+ Teilattribut']],
};
const QUICK_MENU = {
  attribute: 'Attribut hinzufügen', key: 'Schlüssel hinzufügen',
  relationship: 'Beziehung hinzufügen', entity: 'Entity hinzufügen',
};
// Zieht man einen Anfasser ins Leere, entsteht der passende Partner
const PARTNER = { entity: 'relationship', relationship: 'entity', attribute: 'attribute' };

const HINTS = {
  select: 'Doppelklick auf die Fläche: Entity · Anfasser ziehen: verbinden · Rahmen ziehen: Mehrfachauswahl · Rechtsklick: Menü',
  entity: 'Klicke auf die Fläche, um Entities zu platzieren · ⇧ ohne Benennen · Esc oder V zurück zur Auswahl',
  relationship: 'Klicke auf die Fläche, um Beziehungen zu platzieren · ⇧ ohne Benennen · Esc oder V zurück zur Auswahl',
  attribute: 'Klicke auf die Fläche – Attribute werden mit dem ausgewählten Element verbunden · Esc oder V zurück',
  key: 'Klicke auf die Fläche – Schlüssel werden mit dem ausgewählten Element verbunden · Esc oder V zurück',
  connect: 'Quelle anklicken, dann Ziel anklicken – oder von Element zu Element ziehen',
  connectTarget: 'Ziel anklicken oder loslassen – im Leeren entsteht ein neues Element · Esc bricht ab',
};

// Diagramm-Styles: in der Zeichenfläche UND in exportierten SVG/PNG. Die Variablen setzt style.css
// (auch für das dunkle Design); im Export greifen die hellen Ersatzwerte.
const DIAGRAM_CSS = `
text{font:${NAME_FONT};fill:var(--d-text,#1f2430);text-anchor:middle;dominant-baseline:central}
.shape{stroke-width:1.6}
.entity .shape{fill:var(--d-entity-fill,#e8efff);stroke:var(--d-entity-stroke,#3355c4)}
.relationship .shape{fill:var(--d-rel-fill,#fff2dc);stroke:var(--d-rel-stroke,#c97a1c)}
.attribute .shape{fill:var(--d-attr-fill,#ffffff);stroke:var(--d-attr-stroke,#5b6475)}
.attribute.key .shape{fill:var(--d-key-fill,#effaf2);stroke:var(--d-key-stroke,#2f8a4b)}
.dashed{stroke-dasharray:5 4}
.underline{stroke:var(--d-text,#1f2430);stroke-width:1.3}
.underline.dashed{stroke-dasharray:4 3}
.edge .stroke{stroke:var(--d-edge,#4a5263);stroke-width:1.6}
.edge .hit{stroke:transparent;stroke-width:14}
.label-bg{fill:var(--d-label-bg,#ffffff);stroke:var(--d-label-border,#c9ced8);stroke-width:1}
.label{font:${LABEL_FONT}}
.node.selected .shape,.node.target .shape,.edge.selected .stroke{stroke:var(--d-accent,#6741d9);stroke-width:2.6}
.edge.selected .label-bg{stroke:var(--d-accent,#6741d9);stroke-width:1.6}
.node.source .shape{stroke:var(--d-accent,#6741d9);stroke-width:2.6;stroke-dasharray:5 3}
`;

/* ================= DOM ================= */

const $ = (s, root = document) => root.querySelector(s);
const svg = $('#canvas');
const viewport = $('#viewport');
const gEdges = $('#edges');
const gNodes = $('#nodes');
const gBadges = $('#badges');
const gGuides = $('#guides');
const gOverlay = $('#overlay');
const rubber = $('#rubber');
const marquee = $('#marquee');
const panel = $('#panel');
const hint = $('#hint');
const inline = $('#inline');
const fileInput = $('#file');
const titleInput = $('#title');
const ctxMenu = $('#ctxmenu');
const issuesBtn = $('#issues-btn');
const themeBtn = $('#theme-btn');
const dialog = $('#dialog');

const styleEl = document.createElementNS(SVGNS, 'style');
styleEl.textContent = DIAGRAM_CSS;
svg.prepend(styleEl);

/* ================= Zustand ================= */

let state = { title: 'Unbenanntes Diagramm', nodes: [], edges: [] };
let nextId = 1;
let view = { x: 0, y: 0, k: 1 };
let tool = 'select';
let selected = null;        // { kind: 'node' | 'edge', id }
let multi = [];             // Mehrfachauswahl (nur bei mehr als einem Element)
let connectFrom = null;     // Knoten-ID beim Verbinden
let dropTarget = null;      // Knoten unter dem Zeiger beim Verbinden
let hoverId = null;         // Knoten mit eingeblendeten Anfassern
let drag = null;            // laufende Zieh-Aktion
let editing = null;         // Inline-Editor
let lastDown = null;        // für Doppelklick-Erkennung
let spaceDown = false;
let undoStack = [];
let redoStack = [];
let issues = new Map();     // Knoten-ID -> Hinweise
let issueIndex = -1;
let clipboard = null;
let pasteCount = 0;
let menuItems = [];
let prefs = { theme: 'auto', hints: true, snap: true };

const snapshot = () => JSON.stringify(state);
const serialize = () => JSON.stringify({ format: 'er-editor', version: 1, ...state }, null, 2);

function commit(before) {
  if (before === snapshot()) return;
  undoStack.push(before);
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
  persist();
  updateButtons();
}

function restore(json) {
  state = JSON.parse(json);
  nextId = Math.max(0, ...state.nodes.map(n => n.id), ...state.edges.map(e => e.id)) + 1;
  if (selected && !findSelected()) selected = null;
  multi = multi.filter(s => (s.kind === 'node' ? nodeById(s.id) : edgeById(s.id)));
  connectFrom = null;
  titleInput.value = state.title || '';
  render();
  renderPanel();
  persist();
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

// Browser: Autosave im localStorage. Mac-App: Inhalt an das Dokument melden (markiert es als geändert).
function persist() {
  if (NATIVE) {
    window.webkit.messageHandlers.er.postMessage({ type: 'changed', json: serialize() });
    return;
  }
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, view })); } catch { /* egal */ }
}

function nativeCommand(name) {
  window.webkit.messageHandlers.er.postMessage({ type: 'command', name });
}

/* ================= Einstellungen ================= */

const THEME_LABEL = { auto: 'Automatisch', light: 'Hell', dark: 'Dunkel' };
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const THEME_ICON = {
  light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
};

function loadPrefs() {
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY)) }; } catch { /* egal */ }
  if (!THEME_LABEL[prefs.theme]) prefs.theme = 'auto';
}

function setPref(key, value) {
  prefs[key] = value;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* egal */ }
  applyPrefs();
  render();
}

// Tatsächlich angezeigtes Design (bei „Automatisch“ das des Systems)
const effectiveTheme = () => (prefs.theme === 'auto' ? (systemDark.matches ? 'dark' : 'light') : prefs.theme);

function applyPrefs() {
  const root = document.documentElement;
  if (prefs.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = prefs.theme;
  const shown = effectiveTheme();
  themeBtn.innerHTML = THEME_ICON[shown];
  const other = shown === 'dark' ? 'Helles' : 'Dunkles';
  themeBtn.title = `${other} Design einschalten (aktuell ${THEME_LABEL[shown]}` +
    `${prefs.theme === 'auto' ? ', wie das System' : ''}) – Rechtsklick auf die Fläche: Automatisch`;
  if (NATIVE) window.webkit.messageHandlers.er.postMessage({ type: 'theme', value: prefs.theme });
}

// Der Knopf schaltet immer sichtbar um: von Hell auf Dunkel und umgekehrt
function toggleTheme() {
  setPref('theme', effectiveTheme() === 'dark' ? 'light' : 'dark');
}
systemDark.addEventListener('change', applyPrefs);

/* ================= Versionsverlauf ================= */

const CHANGELOG = Array.isArray(window.ER_CHANGELOG) ? window.ER_CHANGELOG : [];
const APP_VERSION = CHANGELOG.length ? CHANGELOG[0].version : '';
const LAST_VERSION_WITHOUT_CHANGELOG = '1.1.1';

function compareVersions(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

const escapeHTML = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Ohne Angabe der ganze Verlauf, sonst nur was seit „since“ neu ist
function showChangelog(since) {
  const entries = since ? CHANGELOG.filter(e => compareVersions(e.version, since) > 0) : CHANGELOG;
  $('#dialog-title').textContent = since ? `Neu in Version ${APP_VERSION}` : 'Versionsverlauf';
  $('#dialog-body').innerHTML = entries.map(e => `
    <section>
      <h3><span${e.version === APP_VERSION ? ' class="current"' : ''}>Version ${escapeHTML(e.version)}</span><small>${formatDate(e.date)}</small></h3>
      <ul>${e.changes.map(c => `<li>${escapeHTML(c)}</li>`).join('')}</ul>
    </section>`).join('') +
    (since ? '<div class="more"><button class="link" data-all>Ganzen Versionsverlauf anzeigen</button></div>' : '');
  closeMenu();
  endEdit(false);
  dialog.hidden = false;
  $('[data-close]', dialog).focus();
}

function closeDialog() {
  dialog.hidden = true;
}

dialog.addEventListener('click', ev => {
  if (ev.target === dialog || ev.target.closest('[data-close]')) closeDialog();
  else if (ev.target.closest('[data-all]')) showChangelog();
});

// Nach einem Update einmal zeigen, was neu ist (nicht bei der ersten Nutzung)
function checkWhatsNew(usedBefore) {
  if (!APP_VERSION) return;
  const seen = prefs.seenVersion || (usedBefore ? LAST_VERSION_WITHOUT_CHANGELOG : APP_VERSION);
  if (compareVersions(APP_VERSION, seen) > 0) showChangelog(seen);
  if (prefs.seenVersion !== APP_VERSION) {
    prefs.seenVersion = APP_VERSION;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* egal */ }
  }
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

const snap = v => (prefs.snap ? Math.round(v / GRID) * GRID : Math.round(v));

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
  return { a, b, p, q, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 };
}

// Kardinalitäten sitzen standardmäßig nahe der Entity; verschoben gilt e.labelT (0..1 entlang der Kante)
function labelPosition(e, geo) {
  const { a, b, p, q } = geo;
  let t = 0.5;
  if (Number.isFinite(e.labelT)) {
    t = e.labelT;
  } else {
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const near = len ? Math.min(0.5, (16 + (textWidth(e.label, LABEL_FONT) + 14) / 2) / len) : 0.5;
    if (a.type === 'entity' && b.type !== 'entity') t = near;
    else if (b.type === 'entity' && a.type !== 'entity') t = 1 - near;
  }
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

function bounds(pad = 0, nodes = state.nodes) {
  if (!nodes.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of nodes) {
    const { w, h } = nodeSize(n);
    x1 = Math.min(x1, n.x - w / 2); y1 = Math.min(y1, n.y - h / 2);
    x2 = Math.max(x2, n.x + w / 2); y2 = Math.max(y2, n.y + h / 2);
  }
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + 2 * pad, h: y2 - y1 + 2 * pad };
}

function collides(x, y, size) {
  return state.nodes.some(n => {
    const s = nodeSize(n);
    return Math.abs(n.x - x) < (s.w + size.w) / 2 + 14 && Math.abs(n.y - y) < (s.h + size.h) / 2 + 12;
  });
}

// Richtung weg von den übrigen Nachbarn (Winkel im Bogenmaß)
function awayAngle(a, others, fallback) {
  let vx = 0, vy = 0;
  for (const m of others) {
    const d = Math.hypot(m.x - a.x, m.y - a.y);
    if (d) { vx += (m.x - a.x) / d; vy += (m.y - a.y) / d; }
  }
  return Math.hypot(vx, vy) < 0.01 ? fallback : Math.atan2(-vy, -vx);
}

const diamond = (hw, hh) => `0,${-hh} ${hw},0 0,${hh} ${-hw},0`;

/* ================= Abfragen ================= */

const nodeById = id => state.nodes.find(n => n.id === id);
const edgeById = id => state.edges.find(e => e.id === id);
const findSelected = () => selected && (selected.kind === 'node' ? nodeById(selected.id) : edgeById(selected.id));
const isSelected = (kind, id) =>
  (selected && selected.kind === kind && selected.id === id) || multi.some(s => s.kind === kind && s.id === id);
const currentSelection = () => (multi.length ? multi.slice() : selected ? [selected] : []);
const selectedNodes = () => currentSelection().filter(s => s.kind === 'node').map(s => nodeById(s.id)).filter(Boolean);
const neighbors = n => state.edges
  .filter(e => e.from === n.id || e.to === n.id)
  .map(e => nodeById(e.from === n.id ? e.to : e.from))
  .filter(Boolean);
const isTextField = t => Boolean(t && t.matches && t.matches('input, textarea, select'));

/* ================= Hinweise ================= */

function computeIssues() {
  const map = new Map();
  const add = (id, text) => { if (!map.has(id)) map.set(id, []); map.get(id).push(text); };
  const names = new Map();
  for (const n of state.nodes) {
    if (n.type !== 'entity' || !n.name.trim()) continue;
    const key = n.name.trim().toLowerCase();
    names.set(key, (names.get(key) || 0) + 1);
  }
  for (const n of state.nodes) {
    const nb = neighbors(n);
    if (n.type === 'entity') {
      const attrs = nb.filter(m => m.type === 'attribute');
      if (n.weak) {
        if (!attrs.some(a => a.partial || a.key)) add(n.id, 'Schwache Entity ohne partiellen Schlüssel');
        if (!nb.some(m => m.type === 'relationship' && m.weak)) add(n.id, 'Schwache Entity ohne identifizierende Beziehung');
      } else if (!attrs.some(a => a.key)) {
        add(n.id, 'Kein Schlüsselattribut');
      }
      if (names.get(n.name.trim().toLowerCase()) > 1) add(n.id, 'Name mehrfach vergeben');
      if (nb.some(m => m.type === 'entity')) add(n.id, 'Direkt mit einer Entity verbunden – Beziehung fehlt');
    } else if (n.type === 'relationship') {
      const count = nb.filter(m => m.type === 'entity').length;
      if (count < 2) add(n.id, count ? 'Nur mit einer Entity verbunden' : 'Mit keiner Entity verbunden');
      if (nb.some(m => m.type === 'relationship')) add(n.id, 'Direkt mit einer Beziehung verbunden');
    } else if (!nb.length) {
      add(n.id, 'Attribut ist nicht verbunden');
    }
  }
  return map;
}

function nextIssue() {
  const ids = [...issues.keys()];
  if (!ids.length) return;
  issueIndex = (issueIndex + 1) % ids.length;
  const n = nodeById(ids[issueIndex]);
  select({ kind: 'node', id: n.id });
  centerOn(n);
}

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
  issues = computeIssues();
  renderBadges();
  renderOverlay();
  const count = issues.size;
  issuesBtn.disabled = !count;
  issuesBtn.classList.toggle('has-issues', count > 0);
  $('#issues-count').textContent = count;
  issuesBtn.title = count ? `${count} ${count === 1 ? 'Hinweis' : 'Hinweise'} – klicken springt zum nächsten` : 'Keine Hinweise';
}

function drawEdge(e) {
  const geo = edgeGeometry(e);
  if (!geo) return;
  const { p, q } = geo;
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
    const pos = labelPosition(e, geo);
    const w = textWidth(e.label, LABEL_FONT) + 14;
    const lg = el('g', { class: 'label-group', 'data-label': e.id }, g);
    el('rect', { class: 'label-bg', x: pos.x - w / 2, y: pos.y - 11, width: w, height: 22, rx: 5 }, lg);
    el('text', { class: 'label', x: pos.x, y: pos.y }, lg).textContent = e.label;
  }
}

function drawNode(n) {
  const { w, h } = nodeSize(n);
  const hw = w / 2, hh = h / 2;
  const cls = ['node', n.type];
  if (n.type === 'attribute' && (n.key || n.partial)) cls.push('key');
  if (isSelected('node', n.id)) cls.push('selected');
  if (connectFrom === n.id) cls.push('source');
  if (dropTarget === n.id) cls.push('target');
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

// Warnsymbole an Elementen mit Hinweisen (nicht Teil des Exports)
function renderBadges() {
  gBadges.textContent = '';
  if (!prefs.hints) return;
  for (const [id] of issues) {
    const n = nodeById(id);
    const { w, h } = nodeSize(n);
    const f = n.type === 'entity' ? 1 : n.type === 'relationship' ? 0.55 : 0.72;
    const g = el('g', { class: 'badge', transform: `translate(${n.x + (w / 2) * f} ${n.y - (h / 2) * f}) scale(${1 / view.k})` }, gBadges);
    el('circle', { r: 8 }, g);
    el('text', { x: 0, y: 0.5 }, g).textContent = '!';
  }
}

// Anfasser und Schnell-Hinzufügen am Element unter dem Zeiger (bzw. am ausgewählten Element)
function overlayTarget() {
  if (drag || editing || multi.length) return null;
  if (hoverId != null && nodeById(hoverId)) return nodeById(hoverId);
  if (selected && selected.kind === 'node') return nodeById(selected.id);
  return null;
}

function renderOverlay() {
  gOverlay.textContent = '';
  const n = overlayTarget();
  if (!n) return;
  const k = view.k;
  const { w, h } = nodeSize(n);
  const hw = (w / 2) * k, hh = (h / 2) * k;
  const off = 11;
  // Bildschirmgröße bleibt beim Zoomen gleich
  const g = el('g', { class: 'overlay', 'data-owner': n.id, transform: `translate(${n.x} ${n.y}) scale(${1 / k})` }, gOverlay);
  for (const [x, y] of [[0, -hh - off], [hw + off, 0], [0, hh + off], [-hw - off, 0]]) {
    const hg = el('g', { class: 'handle', 'data-handle': n.id, transform: `translate(${x} ${y})` }, g);
    el('title', {}, hg).textContent = 'Ziehen zum Verbinden';
    el('circle', { class: 'handle-hit', r: 10 }, hg);
    el('circle', { class: 'handle-dot', r: 4.5 }, hg);
  }
  const pills = QUICK[n.type].map(([type, label]) => ({ type, label, w: textWidth(label, PILL_FONT) + 20 }));
  const gap = 6;
  let x = -(pills.reduce((s, p) => s + p.w, 0) + gap * (pills.length - 1)) / 2;
  const y = -hh - off - 34;
  for (const pill of pills) {
    const pg = el('g', { class: 'quick', 'data-quick': pill.type, 'data-owner': n.id, transform: `translate(${x} ${y})` }, g);
    el('rect', { width: pill.w, height: 24, rx: 12 }, pg);
    el('text', { x: pill.w / 2, y: 12 }, pg).textContent = pill.label;
    x += pill.w + gap;
  }
}

function setHover(id) {
  if (id === hoverId) return;
  hoverId = id;
  renderOverlay();
}

function updateHover(ev, p) {
  const t = ev.target;
  const nodeEl = t.closest && t.closest('[data-node]');
  const ownerEl = t.closest && t.closest('[data-owner]');
  let id = nodeEl ? +nodeEl.dataset.node : ownerEl ? +ownerEl.dataset.owner : null;
  // In der Nähe bleiben die Anfasser sichtbar, damit man sie erreicht
  if (id == null && hoverId != null) {
    const n = nodeById(hoverId);
    if (n) {
      const { w, h } = nodeSize(n);
      const pad = 62 / view.k;
      if (Math.abs(p.x - n.x) <= w / 2 + pad && Math.abs(p.y - n.y) <= h / 2 + pad) id = hoverId;
    }
  }
  setHover(id);
}

function drawGuides(list) {
  gGuides.textContent = '';
  for (const g of list) el('line', { class: 'guide', ...g }, gGuides);
}

function applyView() {
  viewport.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  const s = GRID * 2 * view.k;
  svg.style.backgroundSize = `${s}px ${s}px`;
  svg.style.backgroundPosition = `${view.x}px ${view.y}px`;
  $('#zoom-label').textContent = Math.round(view.k * 100) + ' %';
}

let saveViewTimer;
function viewChanged() {
  applyView();
  renderBadges();
  renderOverlay();
  if (editing) positionInline();
  if (NATIVE) return;  // die Ansicht gehört nicht zum Dokument
  clearTimeout(saveViewTimer);
  saveViewTimer = setTimeout(persist, 300);
}

function centerOn(n) {
  const r = svg.getBoundingClientRect();
  view.x = r.width / 2 - n.x * view.k;
  view.y = r.height / 2 - n.y * view.k;
  viewChanged();
}

/* ================= Werkzeuge & Auswahl ================= */

function setTool(t) {
  endEdit(false);
  tool = t;
  connectFrom = null;
  dropTarget = null;
  rubber.setAttribute('visibility', 'hidden');
  svg.dataset.tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => {
    if (b !== svg) b.setAttribute('aria-pressed', String(b.dataset.tool === t));
  });
  updateHint();
  render();
}

function updateHint() {
  hint.textContent = connectFrom != null ? HINTS.connectTarget : HINTS[tool];
}

let hintTimer;
function flashHint(text) {
  hint.textContent = text;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(updateHint, 2400);
}

function updateButtons() {
  $('[data-cmd="undo"]').disabled = !undoStack.length;
  $('[data-cmd="redo"]').disabled = !redoStack.length;
  $('[data-cmd="delete"]').disabled = !currentSelection().length;
}

function select(sel) {
  selected = sel;
  multi = [];
  render();
  renderPanel();
  updateButtons();
}

function selectMany(items) {
  if (items.length <= 1) { select(items[0] || null); return; }
  selected = null;
  multi = items;
  render();
  renderPanel();
  updateButtons();
}

function toggleInSelection(item) {
  const cur = currentSelection();
  const i = cur.findIndex(s => s.kind === item.kind && s.id === item.id);
  if (i >= 0) cur.splice(i, 1); else cur.push(item);
  selectMany(cur);
}

function selectAll() {
  selectMany([
    ...state.nodes.map(n => ({ kind: 'node', id: n.id })),
    ...state.edges.map(e => ({ kind: 'edge', id: e.id })),
  ]);
}

/* ================= Mutationen ================= */

function makeNode(type, p) {
  const n = {
    id: nextId++,
    type: type === 'key' ? 'attribute' : type,
    x: snap(p.x),
    y: snap(p.y),
    name: type === 'key' ? 'ID' : TYPES[type],
  };
  if (type === 'key') n.key = true;
  return n;
}

// Das Werkzeug bleibt danach aktiv, damit sich mehrere Elemente nacheinander setzen lassen.
function createNode(type, p, skipNaming) {
  const before = snapshot();
  const anchor = selected && selected.kind === 'node' ? nodeById(selected.id) : null;
  const n = makeNode(type, p);
  state.nodes.push(n);
  if (n.type === 'attribute' && anchor) {
    state.edges.push({ id: nextId++, from: anchor.id, to: n.id, label: '' });
  }
  commit(before);
  // Attribute lassen die Auswahl beim Anker, damit weitere Attribute am selben Element landen
  if (n.type !== 'attribute' || !anchor) select({ kind: 'node', id: n.id });
  else render();
  if (!skipNaming) startEdit('node', n.id);
}

// Freier Platz rund um ein Element – Attribute auf der Seite ohne Beziehungen
function freeSpot(a, type) {
  const isAttr = type === 'attribute' || type === 'key';
  const size = nodeSize({ type: isAttr ? 'attribute' : type, name: type === 'key' ? 'ID' : TYPES[type] });
  const as = nodeSize(a);
  const others = isAttr ? neighbors(a).filter(m => m.type !== 'attribute') : neighbors(a);
  const base = awayAngle(a, others, isAttr ? -Math.PI / 2 : 0);
  const step = isAttr ? Math.PI / 7 : Math.PI / 4;
  const angles = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7].map(i => base + i * step);
  for (let ring = 0; ring < 5; ring++) {
    const rx = as.w / 2 + size.w / 2 + (isAttr ? 46 : 90) + ring * 50;
    const ry = as.h / 2 + size.h / 2 + (isAttr ? 40 : 70) + ring * 40;
    for (const ang of angles) {
      const x = a.x + Math.cos(ang) * rx, y = a.y + Math.sin(ang) * ry;
      if (!collides(x, y, size)) return { x, y };
    }
  }
  return { x: a.x + as.w / 2 + 140, y: a.y };
}

function quickAdd(anchorId, type) {
  const a = nodeById(anchorId);
  if (!a) return;
  const before = snapshot();
  const n = makeNode(type, freeSpot(a, type));
  state.nodes.push(n);
  state.edges.push({ id: nextId++, from: a.id, to: n.id, label: '' });
  commit(before);
  // Bei Attributen bleibt die Auswahl beim Element, damit weitere direkt folgen können
  select({ kind: 'node', id: n.type === 'attribute' ? a.id : n.id });
  startEdit('node', n.id);
}

function createPartner(fromId, p) {
  const a = nodeById(fromId);
  if (!a) { cancelConnect(); return; }
  const before = snapshot();
  const n = makeNode(PARTNER[a.type], p);
  state.nodes.push(n);
  state.edges.push({ id: nextId++, from: a.id, to: n.id, label: '' });
  commit(before);
  connectFrom = null;
  rubber.setAttribute('visibility', 'hidden');
  updateHint();
  select({ kind: 'node', id: n.id });
  startEdit('node', n.id);
}

function addEdge(from, to) {
  connectFrom = null;
  dropTarget = null;
  rubber.setAttribute('visibility', 'hidden');
  updateHint();
  if (from === to) { render(); return; }
  const exists = state.edges.some(e => (e.from === from && e.to === to) || (e.from === to && e.to === from));
  if (exists) {
    render();
    flashHint('Diese Elemente sind bereits verbunden.');
    return;
  }
  const before = snapshot();
  const e = { id: nextId++, from, to, label: '' };
  state.edges.push(e);
  commit(before);
  select({ kind: 'edge', id: e.id });
}

function deleteSelected() {
  const items = currentSelection();
  if (!items.length) return;
  const before = snapshot();
  const nodeIds = new Set(items.filter(s => s.kind === 'node').map(s => s.id));
  const edgeIds = new Set(items.filter(s => s.kind === 'edge').map(s => s.id));
  state.nodes = state.nodes.filter(n => !nodeIds.has(n.id));
  state.edges = state.edges.filter(e => !edgeIds.has(e.id) && !nodeIds.has(e.from) && !nodeIds.has(e.to));
  commit(before);
  select(null);
}

function changeType(n, type) {
  const before = snapshot();
  n.type = type;
  for (const f of ['weak', 'key', 'partial', 'multi', 'derived']) delete n[f];
  commit(before);
  render();
  renderPanel();
}

function toggleFlag(obj, flag) {
  const before = snapshot();
  obj[flag] = !obj[flag];
  commit(before);
  render();
  renderPanel();
}

// Attribute im Bogen auf der Seite ohne Beziehungen verteilen; Teilattribute wandern mit
function arrangeAttributes(id) {
  const a = nodeById(id);
  if (!a) return;
  const attrs = neighbors(a).filter(m => m.type === 'attribute');
  if (!attrs.length) return;
  const before = snapshot();
  const base = awayAngle(a, neighbors(a).filter(m => m.type !== 'attribute'), -Math.PI / 2);
  const rel = m => {
    let d = Math.atan2(m.y - a.y, m.x - a.x) - base;
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    return d;
  };
  attrs.sort((m1, m2) => rel(m1) - rel(m2));
  const count = attrs.length;
  const as = nodeSize(a);
  const sizes = attrs.map(m => nodeSize(m));
  const maxW = Math.max(...sizes.map(z => z.w));
  const place = (rx, ry, span) => attrs.map((m, i) => {
    const ang = count === 1 ? base : base - span / 2 + (span * i) / (count - 1);
    return { x: snap(a.x + Math.cos(ang) * rx), y: snap(a.y + Math.sin(ang) * ry) };
  });
  const clash = pos => pos.some((p, i) => pos.some((q, j) => j > i &&
    Math.abs(p.x - q.x) < (sizes[i].w + sizes[j].w) / 2 + 10 && Math.abs(p.y - q.y) < (sizes[i].h + sizes[j].h) / 2 + 8));
  // Höchstens die abgewandte Hälfte nutzen (ohne Beziehungen sind es bis zu drei Viertel);
  // reicht der Platz nicht, wächst der Abstand, bis sich keine Attribute mehr überlappen
  const maxSpan = neighbors(a).some(m => m.type !== 'attribute') ? Math.PI : Math.PI * 1.5;
  let rx = as.w / 2 + maxW / 2 + 40, ry = as.h / 2 + 66;
  const span = count === 1 ? 0 : Math.min(maxSpan, 0.75 * (count - 1));
  let pos = place(rx, ry, span);
  for (let i = 0; i < 40 && clash(pos); i++) {
    rx += 14;
    ry += 12;
    pos = place(rx, ry, span);
  }
  attrs.forEach((m, i) => {
    const { x: nx, y: ny } = pos[i];
    const dx = nx - m.x, dy = ny - m.y;
    for (const sub of neighbors(m)) {
      if (sub.type === 'attribute' && sub.id !== a.id && !attrs.includes(sub)) { sub.x += dx; sub.y += dy; }
    }
    m.x = nx;
    m.y = ny;
  });
  commit(before);
  render();
}

function alignSelection(axis) {
  const nodes = selectedNodes();
  if (nodes.length < 2) return;
  const key = axis === 'h' ? 'y' : 'x';
  const before = snapshot();
  const avg = snap(nodes.reduce((s, n) => s + n[key], 0) / nodes.length);
  for (const n of nodes) n[key] = avg;
  commit(before);
  render();
}

function distributeSelection(axis) {
  const key = axis === 'h' ? 'x' : 'y';
  const nodes = selectedNodes().sort((a, b) => a[key] - b[key]);
  if (nodes.length < 3) return;
  const before = snapshot();
  const first = nodes[0][key], step = (nodes[nodes.length - 1][key] - first) / (nodes.length - 1);
  nodes.forEach((n, i) => { n[key] = Math.round(first + step * i); });
  commit(before);
  render();
}

/* ================= Kopieren & Einsetzen ================= */

function selectionData() {
  const ids = new Set(selectedNodes().map(n => n.id));
  if (!ids.size) return null;
  return {
    format: 'er-editor-clip',
    nodes: state.nodes.filter(n => ids.has(n.id)).map(n => ({ ...n })),
    edges: state.edges.filter(e => ids.has(e.from) && ids.has(e.to)).map(e => ({ ...e })),
  };
}

function storeClipboard(data) {
  clipboard = data;
  pasteCount = 0;
  const text = JSON.stringify(data);
  try { localStorage.setItem(CLIP_KEY, text); } catch { /* egal */ }
  return text;
}

function copySelection(cut) {
  const data = selectionData();
  if (!data) return false;
  const text = storeClipboard(data);
  try { navigator.clipboard?.writeText(text)?.catch(() => {}); } catch { /* egal */ }
  if (cut) deleteSelected();
  const count = data.nodes.length;
  flashHint(`${count} ${count === 1 ? 'Element' : 'Elemente'} ${cut ? 'ausgeschnitten' : 'kopiert'}`);
  return true;
}

function readClipboard() {
  try {
    const data = JSON.parse(localStorage.getItem(CLIP_KEY));
    if (data && data.format === 'er-editor-clip') return data;
  } catch { /* egal */ }
  return clipboard;
}

function pasteClipboard(at) {
  const data = readClipboard();
  if (!data || !data.nodes.length) return false;
  if (at) {
    const b = bounds(0, data.nodes);
    insertData(data, at.x - (b.x + b.w / 2), at.y - (b.y + b.h / 2));
  } else {
    pasteCount++;
    insertData(data, GRID * 3 * pasteCount, GRID * 3 * pasteCount);
  }
  return true;
}

function duplicateSelection() {
  const data = selectionData();
  if (data) insertData(data, GRID * 3, GRID * 3);
}

function insertData(data, dx, dy) {
  endEdit(false);
  const before = snapshot();
  const ids = new Map(), items = [];
  for (const n of data.nodes) {
    if (!TYPES[n.type]) continue;
    const copy = { ...n, id: nextId++, x: Math.round(+n.x + dx), y: Math.round(+n.y + dy), name: String(n.name ?? '') };
    ids.set(n.id, copy.id);
    state.nodes.push(copy);
    items.push({ kind: 'node', id: copy.id });
  }
  for (const e of data.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    const copy = { ...e, id: nextId++, from: ids.get(e.from), to: ids.get(e.to), label: String(e.label ?? '') };
    state.edges.push(copy);
    items.push({ kind: 'edge', id: copy.id });
  }
  commit(before);
  selectMany(items);
}

document.addEventListener('copy', ev => {
  if (isTextField(ev.target)) return;
  const data = selectionData();
  if (!data) return;
  ev.preventDefault();
  ev.clipboardData.setData('text/plain', storeClipboard(data));
});
document.addEventListener('cut', ev => {
  if (isTextField(ev.target)) return;
  const data = selectionData();
  if (!data) return;
  ev.preventDefault();
  ev.clipboardData.setData('text/plain', storeClipboard(data));
  deleteSelected();
});
document.addEventListener('paste', ev => {
  if (isTextField(ev.target)) return;
  try {
    const data = JSON.parse(ev.clipboardData.getData('text/plain'));
    if (!data || data.format !== 'er-editor-clip') return;
    ev.preventDefault();
    storeClipboard(data);
    pasteClipboard();
  } catch { /* kein Diagramm in der Zwischenablage */ }
});

/* ================= Inline-Editor ================= */

function startEdit(kind, id) {
  endEdit(false);
  const obj = kind === 'node' ? nodeById(id) : edgeById(id);
  if (!obj) return;
  editing = { kind, id, before: snapshot(), t: performance.now() };
  inline.value = kind === 'node' ? obj.name : (obj.label || '');
  inline.placeholder = kind === 'node' ? 'Name' : 'z. B. 1, N oder (0,n)';
  inline.hidden = false;
  renderOverlay();
  positionInline();
  inline.focus();
  inline.select();
  // Nach dem laufenden Mausklick erneut markieren – solange noch nichts getippt wurde
  const initial = inline.value, current = editing;
  setTimeout(() => {
    if (editing !== current || inline.value !== initial) return;
    inline.focus();
    inline.select();
  }, 0);
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
    ({ x, y } = labelPosition(obj, geo));
    w = 140;
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
  if (cancel) {
    state = JSON.parse(e.before);
  } else {
    const edge = e.kind === 'edge' && edgeById(e.id);
    if (edge) edge.label = normalizeLabel(edge.label);
    commit(e.before);
  }
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

function isDoubleClick(kind, id, p) {
  const now = performance.now();
  const near = !p || (lastDown && lastDown.p && Math.hypot(p.x - lastDown.p.x, p.y - lastDown.p.y) < 8 / view.k);
  const dbl = lastDown && lastDown.kind === kind && lastDown.id === id && now - lastDown.t < 400 && near;
  lastDown = dbl ? null : { kind, id, t: now, p };
  return Boolean(dbl);
}

function startConnect(id, ev, p, fromHandle) {
  connectFrom = id;
  hoverId = null;
  drag = { type: 'connect', id, fromHandle, sx: ev.clientX, sy: ev.clientY, moved: false };
  svg.setPointerCapture(ev.pointerId);
  updateRubber(p);
  updateHint();
  render();
}

function cancelConnect() {
  connectFrom = null;
  dropTarget = null;
  rubber.setAttribute('visibility', 'hidden');
  updateHint();
  render();
}

function finishConnect(d, ev) {
  const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-node]');
  const target = t ? +t.dataset.node : null;
  dropTarget = null;
  if (target != null && target !== d.id) { addEdge(d.id, target); return; }
  if (d.moved && target == null) { createPartner(d.id, toWorld(ev)); return; }
  // Kanten-Werkzeug mit einfachem Klick: Quelle bleibt gewählt, das Ziel folgt per Klick
  if (d.fromHandle || d.moved) cancelConnect();
}

svg.addEventListener('pointerdown', ev => {
  ev.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  endEdit(false);
  const t = ev.target;
  const quickEl = t.closest('[data-quick]');
  const handleEl = t.closest('[data-handle]');
  const nodeEl = t.closest('[data-node]');
  const labelEl = t.closest('[data-label]');
  const edgeEl = t.closest('[data-edge]');
  const p = toWorld(ev);

  // Ansicht verschieben: mittlere Taste oder Leertaste+Ziehen
  if (ev.button === 1 || (ev.button === 0 && spaceDown)) { startPan(ev); return; }
  // Rechtsklick bzw. Ctrl-Klick (Mac) öffnet das Kontextmenü
  if (ev.button !== 0 || (ev.ctrlKey && IS_MAC)) return;

  if (quickEl) { quickAdd(+quickEl.dataset.owner, quickEl.dataset.quick); return; }
  if (handleEl) { startConnect(+handleEl.dataset.handle, ev, p, true); return; }

  if (tool === 'connect') {
    if (nodeEl) {
      const id = +nodeEl.dataset.node;
      if (connectFrom == null) startConnect(id, ev, p, false);
      else addEdge(connectFrom, id);
    } else {
      cancelConnect();
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
    if (ev.shiftKey) { toggleInSelection({ kind: 'node', id }); return; }
    if (isDoubleClick('node', id)) { select({ kind: 'node', id }); startEdit('node', id); return; }
    // Gehört der Knoten zur Mehrfachauswahl, wird die ganze Gruppe verschoben
    const inGroup = multi.some(s => s.kind === 'node' && s.id === id);
    if (!inGroup) select({ kind: 'node', id });
    const ids = inGroup ? multi.filter(s => s.kind === 'node').map(s => s.id) : [id];
    const origin = ids.map(i => { const n = nodeById(i); return { n, x: n.x, y: n.y }; });
    drag = { type: 'node', primary: id, start: p, origin, before: snapshot(), moved: false };
    svg.setPointerCapture(ev.pointerId);
    return;
  }

  if (labelEl) {
    const id = +labelEl.dataset.label;
    if (ev.shiftKey) { toggleInSelection({ kind: 'edge', id }); return; }
    if (isDoubleClick('edge', id)) { select({ kind: 'edge', id }); startEdit('edge', id); return; }
    select({ kind: 'edge', id });
    drag = { type: 'label', id, before: snapshot(), moved: false };
    svg.setPointerCapture(ev.pointerId);
    return;
  }

  if (edgeEl) {
    const id = +edgeEl.dataset.edge;
    if (ev.shiftKey) { toggleInSelection({ kind: 'edge', id }); return; }
    select({ kind: 'edge', id });
    if (isDoubleClick('edge', id)) startEdit('edge', id);
    return;
  }

  // Hintergrund: Doppelklick legt eine Entity an, Ziehen wählt per Rahmen (⇧ ergänzt)
  if (isDoubleClick('bg', 0, p)) { createNode('entity', p); return; }
  const base = ev.shiftKey ? currentSelection() : [];
  if (!ev.shiftKey) select(null);
  drag = { type: 'marquee', start: p, base };
  svg.setPointerCapture(ev.pointerId);
});

function updateMarquee(p) {
  const x1 = Math.min(drag.start.x, p.x), x2 = Math.max(drag.start.x, p.x);
  const y1 = Math.min(drag.start.y, p.y), y2 = Math.max(drag.start.y, p.y);
  marquee.setAttribute('x', x1); marquee.setAttribute('y', y1);
  marquee.setAttribute('width', x2 - x1); marquee.setAttribute('height', y2 - y1);
  marquee.setAttribute('visibility', 'visible');

  // Knoten zählen, sobald der Rahmen sie berührt; Kanten über ihren Mittelpunkt
  const hits = [];
  for (const n of state.nodes) {
    const { w, h } = nodeSize(n);
    if (n.x + w / 2 >= x1 && n.x - w / 2 <= x2 && n.y + h / 2 >= y1 && n.y - h / 2 <= y2) hits.push({ kind: 'node', id: n.id });
  }
  for (const e of state.edges) {
    const geo = edgeGeometry(e);
    if (geo && geo.mx >= x1 && geo.mx <= x2 && geo.my >= y1 && geo.my <= y2) hits.push({ kind: 'edge', id: e.id });
  }
  const items = drag.base.slice();
  for (const h of hits) if (!items.some(s => s.kind === h.kind && s.id === h.id)) items.push(h);
  selectMany(items);
}

// Knoten verschieben: an anderen Mittelpunkten ausrichten (mit Hilfslinie), sonst am Raster einrasten.
// ⌥ hält die Einrastfunktion kurz an.
function moveNodes(p, free) {
  const primary = drag.origin.find(o => o.n.id === drag.primary) || drag.origin[0];
  let tx = primary.x + p.x - drag.start.x;
  let ty = primary.y + p.y - drag.start.y;
  const guides = [];
  if (prefs.snap && !free) {
    const tol = 6 / view.k;
    const moving = new Set(drag.origin.map(o => o.n.id));
    let bx = null, by = null;
    for (const n of state.nodes) {
      if (moving.has(n.id)) continue;
      const dx = Math.abs(n.x - tx), dy = Math.abs(n.y - ty);
      if (dx < tol && (!bx || dx < bx.d)) bx = { d: dx, n };
      if (dy < tol && (!by || dy < by.d)) by = { d: dy, n };
    }
    tx = bx ? bx.n.x : snap(tx);
    ty = by ? by.n.y : snap(ty);
    const ext = 30 / view.k;
    if (bx) guides.push({ x1: tx, x2: tx, y1: Math.min(ty, bx.n.y) - ext, y2: Math.max(ty, bx.n.y) + ext });
    if (by) guides.push({ y1: ty, y2: ty, x1: Math.min(tx, by.n.x) - ext, x2: Math.max(tx, by.n.x) + ext });
  }
  const dx = tx - primary.x, dy = ty - primary.y;
  for (const o of drag.origin) {
    o.n.x = Math.round(o.x + dx);
    o.n.y = Math.round(o.y + dy);
  }
  drawGuides(guides);
}

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
  if (connectFrom != null) {
    updateRubber(p);
    const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-node]');
    const id = t ? +t.dataset.node : null;
    const target = id !== connectFrom ? id : null;
    if (target !== dropTarget) { dropTarget = target; render(); }
  }
  if (!drag) { updateHover(ev, p); return; }

  if (drag.type === 'pan') {
    view.x = drag.vx + ev.clientX - drag.sx;
    view.y = drag.vy + ev.clientY - drag.sy;
    viewChanged();
  } else if (drag.type === 'marquee') {
    updateMarquee(p);
  } else if (drag.type === 'connect') {
    if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 6) drag.moved = true;
  } else if (drag.type === 'label') {
    const e = edgeById(drag.id), geo = edgeGeometry(e);
    const vx = geo.q.x - geo.p.x, vy = geo.q.y - geo.p.y;
    const t = ((p.x - geo.p.x) * vx + (p.y - geo.p.y) * vy) / (vx * vx + vy * vy || 1);
    e.labelT = Math.round(Math.min(0.92, Math.max(0.08, t)) * 1000) / 1000;
    drag.moved = true;
    render();
  } else if (drag.type === 'node') {
    moveNodes(p, ev.altKey);
    drag.moved = true;
    lastDown = null;
    render();
  }
});

svg.addEventListener('pointerup', ev => {
  if (!drag) return;
  const d = drag;
  drag = null;
  svg.classList.remove('panning');
  marquee.setAttribute('visibility', 'hidden');
  drawGuides([]);
  if ((d.type === 'node' || d.type === 'label') && d.moved) commit(d.before);
  if (d.type === 'connect') finishConnect(d, ev);
  render();  // Anfasser wieder einblenden
});

svg.addEventListener('pointercancel', () => {
  const d = drag;
  drag = null;
  svg.classList.remove('panning');
  marquee.setAttribute('visibility', 'hidden');
  drawGuides([]);
  if (d && d.type === 'connect') cancelConnect();
  else render();
});

svg.addEventListener('pointerleave', () => { if (!drag) setHover(null); });

// Scrollen = Ansicht verschieben, Strg/⌘ + Scrollen bzw. Pinch = Zoomen
svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  closeMenu();
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

function zoomReset() {
  const r = svg.getBoundingClientRect();
  zoomAt(1 / view.k, r.width / 2, r.height / 2);
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

/* ================= Kontextmenü ================= */

function openMenu(x, y, items) {
  menuItems = items;
  ctxMenu.innerHTML = items.map((it, i) => {
    if (it === '-') return '<div class="sep" role="separator"></div>';
    const mark = 'checked' in it ? `<span class="mark">${it.checked ? '✓' : ''}</span>` : '';
    const cls = it.danger ? ' class="danger-item"' : '';
    return `<button role="menuitem" data-i="${i}"${cls}${it.disabled ? ' disabled' : ''}>` +
      `<span>${mark}${it.label}</span>${it.key ? `<kbd>${it.key}</kbd>` : ''}</button>`;
  }).join('');
  ctxMenu.hidden = false;
  const r = ctxMenu.getBoundingClientRect();
  ctxMenu.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + 'px';
  ctxMenu.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + 'px';
  ctxMenu.focus();  // Pfeiltasten wählen Einträge, die Maus hebt nur hervor, was darunter liegt
}

function closeMenu() {
  if (ctxMenu.hidden) return;
  ctxMenu.hidden = true;
  menuItems = [];
}

const MOD = IS_MAC ? '⌘' : 'Strg+';

function menuForBackground(p) {
  return [
    { label: 'Entity hier einfügen', key: 'Doppelklick', run: () => createNode('entity', p) },
    { label: 'Beziehung hier einfügen', run: () => createNode('relationship', p) },
    { label: 'Hier einsetzen', key: `${MOD}V`, disabled: !readClipboard(), run: () => pasteClipboard(p) },
    '-',
    { label: 'Alles auswählen', key: `${MOD}A`, run: selectAll },
    { label: 'Alles einpassen', key: 'F', run: fit },
    '-',
    { label: 'Am Raster einrasten', checked: prefs.snap, run: () => setPref('snap', !prefs.snap) },
    { label: 'Hinweise anzeigen', checked: prefs.hints, run: () => setPref('hints', !prefs.hints) },
    '-',
    ...Object.entries(THEME_LABEL).map(([value, label]) => (
      { label: `Design: ${label}`, checked: prefs.theme === value, run: () => setPref('theme', value) }
    )),
  ];
}

function menuForNode(n) {
  const items = [{ label: 'Umbenennen', key: 'Enter', run: () => startEdit('node', n.id) }];
  for (const [type] of QUICK[n.type]) {
    const label = n.type === 'attribute' ? 'Teilattribut hinzufügen' : QUICK_MENU[type];
    items.push({ label, run: () => quickAdd(n.id, type) });
  }
  if (n.type !== 'attribute') {
    const has = neighbors(n).some(m => m.type === 'attribute');
    items.push({ label: 'Attribute anordnen', disabled: !has, run: () => arrangeAttributes(n.id) });
  }
  items.push('-');
  for (const [type, label] of Object.entries(TYPES)) {
    if (type !== n.type) items.push({ label: `In ${label} umwandeln`, run: () => changeType(n, type) });
  }
  items.push('-', ...clipboardItems(), '-', { label: 'Löschen', key: 'Entf', danger: true, run: deleteSelected });
  return items;
}

function menuForEdge(e) {
  return [
    { label: 'Beschriften', key: 'Enter', run: () => startEdit('edge', e.id) },
    { label: 'Totale Teilnahme', checked: Boolean(e.total), run: () => toggleFlag(e, 'total') },
    {
      label: 'Beschriftung an Standardposition', disabled: !Number.isFinite(e.labelT),
      run: () => { const before = snapshot(); delete e.labelT; commit(before); render(); },
    },
    '-',
    { label: 'Löschen', key: 'Entf', danger: true, run: deleteSelected },
  ];
}

function menuForMulti() {
  const count = selectedNodes().length;
  return [
    ...clipboardItems(),
    '-',
    { label: 'Auf gleiche Höhe bringen', disabled: count < 2, run: () => alignSelection('h') },
    { label: 'Untereinander ausrichten', disabled: count < 2, run: () => alignSelection('v') },
    { label: 'Waagerecht verteilen', disabled: count < 3, run: () => distributeSelection('h') },
    { label: 'Senkrecht verteilen', disabled: count < 3, run: () => distributeSelection('v') },
    '-',
    { label: 'Alle löschen', key: 'Entf', danger: true, run: deleteSelected },
  ];
}

function clipboardItems() {
  const none = !selectedNodes().length;
  return [
    { label: 'Kopieren', key: `${MOD}C`, disabled: none, run: () => copySelection(false) },
    { label: 'Ausschneiden', key: `${MOD}X`, disabled: none, run: () => copySelection(true) },
    { label: 'Duplizieren', key: `${MOD}D`, disabled: none, run: duplicateSelection },
  ];
}

svg.addEventListener('contextmenu', ev => {
  ev.preventDefault();
  endEdit(false);
  if (drag) return;
  const t = ev.target;
  const nodeEl = t.closest('[data-node]') || t.closest('[data-owner]');
  const edgeEl = t.closest('[data-edge]');
  const p = toWorld(ev);
  let items;
  if (nodeEl || edgeEl) {
    const item = nodeEl
      ? { kind: 'node', id: +(nodeEl.dataset.node ?? nodeEl.dataset.owner) }
      : { kind: 'edge', id: +edgeEl.dataset.edge };
    if (!isSelected(item.kind, item.id)) select(item);
    if (multi.length) items = menuForMulti();
    else if (item.kind === 'node') items = menuForNode(nodeById(item.id));
    else items = menuForEdge(edgeById(item.id));
  } else {
    items = menuForBackground(p);
  }
  openMenu(ev.clientX, ev.clientY, items);
});

ctxMenu.addEventListener('click', ev => {
  const btn = ev.target.closest('button[data-i]');
  if (!btn) return;
  const item = menuItems[+btn.dataset.i];
  closeMenu();
  if (item && item.run) item.run();
});
ctxMenu.addEventListener('keydown', ev => {
  const buttons = [...ctxMenu.querySelectorAll('button:not(:disabled)')];
  const i = buttons.indexOf(document.activeElement);
  if (ev.key === 'ArrowDown') { ev.preventDefault(); buttons[(i + 1) % buttons.length]?.focus(); }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length]?.focus(); }
  if (ev.key === 'Escape') { ev.preventDefault(); closeMenu(); }
  ev.stopPropagation();
});
document.addEventListener('pointerdown', ev => { if (!ctxMenu.contains(ev.target)) closeMenu(); }, true);
window.addEventListener('blur', closeMenu);
window.addEventListener('resize', closeMenu);

/* ================= Tastatur ================= */

document.addEventListener('keydown', ev => {
  if (!dialog.hidden) {
    if (ev.key === 'Escape') { ev.preventDefault(); closeDialog(); }
    return;
  }
  if (isTextField(ev.target)) return;
  const mod = ev.metaKey || ev.ctrlKey;
  const key = ev.key.toLowerCase();

  if (mod && key === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
  if (mod && key === 'y') { ev.preventDefault(); redo(); return; }
  if (mod && key === 's') { ev.preventDefault(); COMMANDS.save(); return; }
  if (mod && key === 'o') { ev.preventDefault(); COMMANDS.open(); return; }
  if (mod && key === 'a') { ev.preventDefault(); selectAll(); return; }
  if (mod && key === 'c') { if (copySelection(false)) ev.preventDefault(); return; }
  if (mod && key === 'x') { if (copySelection(true)) ev.preventDefault(); return; }
  if (mod && key === 'v') { if (readClipboard()) { ev.preventDefault(); pasteClipboard(); } return; }
  if (mod && key === 'd') { ev.preventDefault(); duplicateSelection(); return; }
  if (mod) return;

  if (ev.key === ' ') { spaceDown = true; ev.preventDefault(); return; }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); deleteSelected(); return; }
  if (ev.key === 'Escape') {
    if (connectFrom != null) { cancelConnect(); return; }
    setTool('select');
    select(null);
    return;
  }
  if (ev.key === 'Enter' && selected) { ev.preventDefault(); startEdit(selected.kind, selected.id); return; }

  const movable = selectedNodes();
  if (ev.key.startsWith('Arrow') && movable.length) {
    ev.preventDefault();
    const step = ev.shiftKey ? GRID * 2 : 1;
    const before = snapshot();
    for (const n of movable) {
      if (ev.key === 'ArrowLeft') n.x -= step;
      if (ev.key === 'ArrowRight') n.x += step;
      if (ev.key === 'ArrowUp') n.y -= step;
      if (ev.key === 'ArrowDown') n.y += step;
    }
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
    <p><b>Doppelklick</b> auf die Fläche legt eine Entity an. Fährst du über ein Element, erscheinen <b>Anfasser</b> zum Verbinden und Knöpfe zum <b>Hinzufügen</b>.</p>
    <p>Zieht man einen Anfasser ins Leere, entsteht direkt das passende Gegenstück. <b>Rechtsklick</b> öffnet ein Menü.</p>
    <h2>Tastenkürzel</h2>
    <ul>
      <li>Auswahl <kbd>V</kbd></li>
      <li>Entity <kbd>E</kbd></li>
      <li>Beziehung <kbd>R</kbd></li>
      <li>Attribut <kbd>A</kbd></li>
      <li>Schlüssel <kbd>K</kbd></li>
      <li>Kante <kbd>C</kbd></li>
      <li>Umbenennen <kbd>Enter</kbd></li>
      <li>Mehrfachauswahl <kbd>Rahmen / ⇧ Klick</kbd></li>
      <li>Alles auswählen <kbd>${MOD}A</kbd></li>
      <li>Kopieren / Einsetzen <kbd>${MOD}C / ${MOD}V</kbd></li>
      <li>Duplizieren <kbd>${MOD}D</kbd></li>
      <li>Löschen <kbd>Entf</kbd></li>
      <li>Rückgängig <kbd>${MOD}Z</kbd></li>
      <li>Ohne Einrasten ziehen <kbd>${IS_MAC ? '⌥' : 'Alt'}</kbd></li>
      <li>Alles einpassen <kbd>F</kbd></li>
      <li>Ansicht ziehen <kbd>Leertaste</kbd></li>
      <li>Zoomen <kbd>${MOD} Scroll</kbd></li>
    </ul>
    <p class="version-line">Version ${escapeHTML(APP_VERSION)} · <button class="link" data-action="changelog">Neuigkeiten</button></p>
  </div>`;

let panelBefore = null;

function issuesHTML(id) {
  const list = issues.get(id);
  if (!list) return '';
  return `<ul class="issues">${list.map(t => `<li>${t}</li>`).join('')}</ul>`;
}

function renderPanel() {
  const obj = findSelected();
  if (!obj && multi.length) {
    const nodes = multi.filter(s => s.kind === 'node').length;
    const edges = multi.length - nodes;
    const parts = [];
    if (nodes) parts.push(`${nodes} ${nodes === 1 ? 'Element' : 'Elemente'}`);
    if (edges) parts.push(`${edges} ${edges === 1 ? 'Kante' : 'Kanten'}`);
    panel.innerHTML = `
      <h2>Mehrfachauswahl</h2>
      <div class="info">${parts.join(' und ')} ausgewählt</div>
      <div class="help"><p>Ziehen oder Pfeiltasten verschieben alle gemeinsam. ⇧ + Klick nimmt einzelne Elemente hinzu oder heraus. Rechtsklick zum Ausrichten.</p></div>
      <div class="actions">
        <button data-action="duplicate">Duplizieren</button>
        <button data-action="align-h" ${nodes < 2 ? 'disabled' : ''}>Gleiche Höhe</button>
        <button data-action="align-v" ${nodes < 2 ? 'disabled' : ''}>Untereinander</button>
      </div>
      <button class="danger" data-action="delete">Alle löschen</button>`;
    return;
  }
  if (!obj) { panel.innerHTML = HELP_HTML; return; }

  const isNode = selected.kind === 'node';
  const flags = FLAGS[isNode ? obj.type : 'edge'];
  const flagHTML = flags.map(([prop, label, sub]) => `
    <label class="check"><input type="checkbox" data-flag="${prop}">
      <span>${label}<small>${sub}</small></span></label>`).join('');

  if (isNode) {
    const degree = state.edges.filter(e => e.from === obj.id || e.to === obj.id).length;
    const hasAttrs = neighbors(obj).some(m => m.type === 'attribute');
    const quick = QUICK[obj.type].map(([type, label]) => `<button data-quick="${type}">${label}</button>`).join('');
    panel.innerHTML = `
      <h2>${TYPES[obj.type]}</h2>
      ${issuesHTML(obj.id)}
      <label class="field"><span>Name</span><input type="text" data-text="name" autocomplete="off"></label>
      <label class="field"><span>Typ</span><select data-type>
        ${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select></label>
      ${flagHTML}
      <div class="field"><span>Hinzufügen</span><div class="actions">${quick}</div></div>
      ${obj.type !== 'attribute' ? `<button class="wide" data-action="arrange" ${hasAttrs ? '' : 'disabled'}>Attribute anordnen</button>` : ''}
      <div class="info">${degree} ${degree === 1 ? 'Verbindung' : 'Verbindungen'}</div>
      <button class="danger" data-action="delete">Löschen</button>`;
    $('[data-type]', panel).value = obj.type;
  } else {
    panel.innerHTML = `
      <h2>Kante</h2>
      <label class="field"><span>Beschriftung</span><input type="text" data-text="label" autocomplete="off" placeholder="z. B. 1, N oder (0,n)"></label>
      <div class="presets">
        ${LABEL_PRESETS.map(l => `<button data-preset="${l}" aria-pressed="${obj.label === l}">${l}</button>`).join('')}
        <button data-preset="" title="Beschriftung entfernen">✕</button>
      </div>
      ${flagHTML}
      <div class="help"><p>Die Beschriftung lässt sich entlang der Kante verschieben.</p></div>
      ${Number.isFinite(obj.labelT) ? '<button class="wide" data-action="label-reset">Beschriftung an Standardposition</button>' : ''}
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
  if (!ev.target.matches('[data-text]') || !panelBefore) return;
  const obj = findSelected();
  if (obj && ev.target.dataset.text === 'label') {
    obj.label = normalizeLabel(obj.label);
    render();
    renderPanel();
  }
  commit(panelBefore);
  panelBefore = null;
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
  if (t.matches('[data-type]')) { changeType(obj, t.value); return; }
  if (!t.matches('[data-flag]')) return;
  const before = snapshot();
  obj[t.dataset.flag] = t.checked;
  if (t.dataset.flag === 'key' && t.checked) obj.partial = false;
  if (t.dataset.flag === 'partial' && t.checked) obj.key = false;
  commit(before);
  render();
  renderPanel();
});

panel.addEventListener('click', ev => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'delete') { deleteSelected(); return; }
  if (action === 'changelog') { showChangelog(); return; }
  if (action === 'duplicate') { duplicateSelection(); return; }
  if (action === 'align-h') { alignSelection('h'); return; }
  if (action === 'align-v') { alignSelection('v'); return; }
  if (action === 'arrange' && selected) { arrangeAttributes(selected.id); return; }
  if (action === 'label-reset') {
    const e = findSelected();
    const before = snapshot();
    delete e.labelT;
    commit(before);
    render();
    renderPanel();
    return;
  }
  if (btn.dataset.quick && selected) { quickAdd(selected.id, btn.dataset.quick); return; }
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
  download(fileBase() + '.json', new Blob([serialize()], { type: 'application/json' }));
}

function loadData(data) {
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error('Kein gültiges ER-Diagramm.');
  const nodes = data.nodes
    .filter(n => n && Number.isFinite(n.id) && TYPES[n.type])
    .map(n => ({ ...n, x: +n.x || 0, y: +n.y || 0, name: String(n.name ?? '') }));
  const ids = new Set(nodes.map(n => n.id));
  const edges = data.edges
    .filter(e => e && Number.isFinite(e.id) && ids.has(e.from) && ids.has(e.to))
    .map(e => {
      const edge = { ...e, label: normalizeLabel(String(e.label ?? '')) };
      if (!(Number.isFinite(edge.labelT) && edge.labelT >= 0 && edge.labelT <= 1)) delete edge.labelT;
      return edge;
    });
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
    multi = [];
    restore(JSON.stringify(loaded));
    commit(before);
    fit();
  } catch (err) {
    alert('Datei konnte nicht geladen werden: ' + err.message);
  }
});

function exportSVGMarkup() {
  const sel = selected, group = multi, src = connectFrom;
  selected = null; multi = []; connectFrom = null;
  render();
  const b = bounds(30) || { x: 0, y: 0, w: 100, h: 100 };
  const markup =
    `<svg xmlns="${SVGNS}" width="${Math.ceil(b.w)}" height="${Math.ceil(b.h)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">` +
    `<style>${DIAGRAM_CSS}</style>` +
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ffffff"/>` +
    gEdges.outerHTML + gNodes.outerHTML + '</svg>';
  selected = sel; multi = group; connectFrom = src;
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
  multi = [];
  commit(before);
  render();
  renderPanel();
  fit();
}

/* ================= Toolbar ================= */

// In der Mac-App übernehmen die nativen Dokumentfunktionen Neu, Öffnen und Sichern
const COMMANDS = {
  undo, redo,
  delete: deleteSelected,
  new: NATIVE ? () => nativeCommand('new') : newDiagram,
  open: NATIVE ? () => nativeCommand('open') : () => fileInput.click(),
  save: NATIVE ? () => { endEdit(false); nativeCommand('save'); } : saveJSON,
  svg: exportSVG,
  png: exportPNG,
  issues: nextIssue,
  theme: toggleTheme,
  'zoom-in': () => zoomCenter(1.2),
  'zoom-out': () => zoomCenter(1 / 1.2),
  'zoom-reset': zoomReset,
  fit,
};

document.addEventListener('click', ev => {
  const btn = ev.target.closest('button');
  if (!btn || panel.contains(btn) || ctxMenu.contains(btn)) return;
  if (btn.dataset.tool) setTool(btn.dataset.tool);
  if (btn.dataset.cmd) COMMANDS[btn.dataset.cmd]();
});

/* ================= Schnittstelle zur Mac-App ================= */

window.ERBridge = {
  // Inhalt eines Dokuments anzeigen (null = neues, leeres Dokument)
  load(json) {
    let data = { title: 'Unbenanntes Diagramm', nodes: [], edges: [] };
    let migrated = false;
    if (json) {
      try {
        data = loadData(JSON.parse(json));
      } catch (err) {
        alert('Datei konnte nicht gelesen werden: ' + err.message);
      }
    } else {
      // Einmalig: das Diagramm aus früheren Versionen (Autosave) als erstes neues Dokument übernehmen
      try {
        const legacy = !localStorage.getItem(MIGRATED_KEY) && localStorage.getItem(STORE_KEY);
        if (legacy) {
          data = loadData(JSON.parse(legacy));
          localStorage.setItem(MIGRATED_KEY, '1');
          migrated = data.nodes.length > 0;
        }
      } catch { /* egal */ }
    }
    endEdit(false);
    state = data;
    nextId = Math.max(0, ...state.nodes.map(n => n.id), ...state.edges.map(e => e.id)) + 1;
    undoStack = [];
    redoStack = [];
    selected = null;
    multi = [];
    titleInput.value = state.title;
    render();
    renderPanel();
    updateButtons();
    fit();
    if (migrated) {
      persist();
      flashHint('Dein bisheriges Diagramm wurde übernommen – bitte sichern (⌘S).');
    }
  },
  // Aktueller Inhalt zum Sichern
  flush() {
    return serialize();
  },
  // Befehle aus der Menüleiste
  menu(cmd) {
    const field = isTextField(document.activeElement) ? document.activeElement : null;
    const actions = {
      undo: () => (field ? document.execCommand('undo') : undo()),
      redo: () => (field ? document.execCommand('redo') : redo()),
      selectAll: () => (field ? field.select() : selectAll()),
      duplicate: duplicateSelection,
      delete: () => { if (!field) deleteSelected(); },
      zoomIn: () => zoomCenter(1.2),
      zoomOut: () => zoomCenter(1 / 1.2),
      zoomReset,
      fit,
      exportSVG,
      exportPNG,
      nextIssue,
      changelog: () => showChangelog(),
      themeAuto: () => setPref('theme', 'auto'),
      themeLight: () => setPref('theme', 'light'),
      themeDark: () => setPref('theme', 'dark'),
    };
    actions[cmd]?.();
  },
};

/* ================= Beispiel & Start ================= */

function sampleDiagram() {
  const nodes = [
    { id: 1, type: 'entity', x: 264, y: 297, name: 'Student' },
    { id: 2, type: 'relationship', x: 528, y: 297, name: 'besucht' },
    { id: 3, type: 'entity', x: 792, y: 297, name: 'Kurs' },
    { id: 4, type: 'attribute', x: 132, y: 176, name: 'MatrNr', key: true },
    { id: 5, type: 'attribute', x: 264, y: 154, name: 'Name' },
    { id: 6, type: 'attribute', x: 132, y: 418, name: 'Semester' },
    { id: 7, type: 'attribute', x: 528, y: 165, name: 'Note' },
    { id: 8, type: 'attribute', x: 792, y: 154, name: 'KursNr', key: true },
    { id: 9, type: 'attribute', x: 924, y: 220, name: 'Titel' },
    { id: 10, type: 'attribute', x: 924, y: 396, name: 'Teilnehmer', derived: true },
  ];
  const edges = [
    { id: 11, from: 1, to: 2, label: '(0,n)' },
    { id: 12, from: 2, to: 3, label: '(1,n)', total: true },
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
  let usedBefore = false;
  try { usedBefore = [PREFS_KEY, STORE_KEY].some(k => localStorage.getItem(k) != null); } catch { /* egal */ }
  loadPrefs();
  applyPrefs();
  if (NATIVE) document.documentElement.classList.add('native');
  let stored = null;
  if (!NATIVE) {
    try { stored = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { /* egal */ }
  }
  let data;
  if (NATIVE) data = { title: 'Unbenanntes Diagramm', nodes: [], edges: [] };  // Inhalt kommt per ERBridge.load
  else {
    try { data = stored ? loadData(stored) : sampleDiagram(); } catch { data = sampleDiagram(); }
  }
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
  checkWhatsNew(usedBefore);
}

init();
