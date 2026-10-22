// The map editor: a top-down view of a valley with a live relief (rawHeight of the map being
// edited), and tools for hills and dips, flats, lakes, the river and its fords, roads, forests,
// rocks, iron, salt, places of interest and the two seats. Pure DOM + 2D canvas, no 3D: what it
// edits is the map layout (map-format.js), which the game turns into terrain when you play it.
import { h, clear } from '../ui/dom.js';
import { rawHeight, distToPolyline } from '../world/terrain-data.js';
import { MAPS } from '../world/maps/index.js';
import { generateWildMap } from '../world/maps/wild.js';
import { normalizeMap, validateMap, mapProblems, blankMap, mapFrom, LIMITS, MAP_HALF, MAP_LIMIT } from './map-format.js';
import { listMaps, saveMap, deleteMap, exportMap, importMap, MAX_MAPS } from './storage.js';

const SIZE = 640; // canvas pixels for the whole map (2 * MAP_HALF metres)
const RELIEF = 192; // relief samples per side (2 m each)
const toPx = (x) => ((x + MAP_HALF) / (2 * MAP_HALF)) * SIZE;
const toM = (px) => (px / SIZE) * 2 * MAP_HALF - MAP_HALF;
const clampC = (v) => Math.round(Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, v)) * 10) / 10;

// tools: [id, label, group, hint]
const TOOLS = [
  ['select', 'Select', 'Edit', 'Click something to select it, drag to move it. Mouse wheel: size; Shift + wheel: height or number. Delete removes it.'],
  ['erase', 'Erase', 'Edit', 'Click something to remove it.'],
  ['hill', 'Hill', 'Land', 'Click to raise a hill.'],
  ['dip', 'Hollow', 'Land', 'Click to sink a hollow.'],
  ['flat', 'Flat', 'Land', 'Level ground for building.'],
  ['lake', 'Lake', 'Water', 'Click to dig a lake.'],
  ['river', 'River point', 'Water', 'Click to add a bend to the river (it joins the nearest stretch). A river is always there.'],
  ['ford', 'Ford', 'Water', 'A shallow crossing: put it on the river.'],
  ['road', 'Road', 'Places', 'Click point after point; Esc or right-click ends the road.'],
  ['forest', 'Forest', 'Nature', 'Trees for Woodcutter\'s Lodges.'],
  ['rocks', 'Rocks', 'Nature', 'Rock outcrops for a Quarry.'],
  ['iron', 'Iron', 'Nature', 'An iron vein for a Mine.'],
  ['salt', 'Salt pan', 'Nature', 'Salt for Saltworks.'],
  ['trader', 'Trader', 'Places', 'A market to buy and sell goods.'],
  ['cairn', 'Cairn', 'Places', 'A lookout that reveals the land around it.'],
  ['ruin', 'Ruin', 'Places', 'An old vault with a reward inside.'],
  ['hamlet', 'Hamlet', 'Places', 'A village Maren can win over.'],
  ['start', 'Your Keep', 'Seats', 'Where your town begins.'],
  ['camp', 'Enemy seat', 'Seats', 'Where the lord\'s seat (or the rival town) stands.'],
];
// map list -> kind of selection
const KIND_OF = { hills: 'hill', flats: 'flat', lakes: 'lake', forests: 'forest', rocks: 'rocks', ironVeins: 'iron', saltPans: 'salt', pois: 'poi', fords: 'ford' };

/** The editable copy of a map: the seats' derived flats are left out (normalize adds them again). */
function toDraft(map) {
  const m = JSON.parse(JSON.stringify(map));
  m.flats = (m.flats || []).filter((f) => ![m.playerStart, m.enemyCamp].some((s) => Math.hypot(f.x - s.x, f.z - s.z) < 4));
  return m;
}

export function createMapEditor({ initial = null, mapId = null, onPlay, onBack }) {
  let draft = toDraft(initial || blankMap());
  let id = mapId;
  let tool = 'select';
  let sel = null; // { list, i } | { river: i } | { road, i } | { seat: 'playerStart'|'enemyCamp' }
  let drag = null, activeRoad = null, dirty = false;
  const full = () => normalizeMap(draft);

  const canvas = h('canvas.ed-canvas', { width: SIZE, height: SIZE, 'aria-label': 'Map. Click to place with the chosen tool.' });
  const ctx = canvas.getContext('2d');
  const relief = document.createElement('canvas');
  relief.width = relief.height = RELIEF;
  const rctx = relief.getContext('2d');
  let reliefKey = '', reliefTimer = 0, heightOf = (x, z) => rawHeight(full(), x, z);

  // --- relief ---------------------------------------------------------------------------------
  function terrainKey(m) { return JSON.stringify([m.noiseSeed, m.baseHeight, m.noiseAmp, m.hills, m.flats, m.lakes, m.islands, m.river]); }
  function buildRelief() {
    const m = full();
    const key = terrainKey(m);
    if (key === reliefKey) return;
    reliefKey = key;
    const hs = new Float32Array(RELIEF * RELIEF);
    for (let j = 0; j < RELIEF; j++) for (let i = 0; i < RELIEF; i++) hs[j * RELIEF + i] = rawHeight(m, toM(((i + 0.5) / RELIEF) * SIZE), toM(((j + 0.5) / RELIEF) * SIZE));
    const img = rctx.createImageData(RELIEF, RELIEF);
    for (let j = 0; j < RELIEF; j++) for (let i = 0; i < RELIEF; i++) {
      const k = j * RELIEF + i, hh = hs[k];
      const hx = hs[j * RELIEF + Math.min(RELIEF - 1, i + 1)] - hs[j * RELIEF + Math.max(0, i - 1)];
      const hz = hs[Math.min(RELIEF - 1, j + 1) * RELIEF + i] - hs[Math.max(0, j - 1) * RELIEF + i];
      const shade = Math.max(0.55, Math.min(1.25, 1 - (hx - hz) * 0.12));
      let r, g, b;
      if (hh < 0) { const d = Math.min(1, -hh / 2.5); r = 46 - d * 16; g = 104 - d * 30; b = 128 - d * 20; }
      else if (hh < 7) { r = 98 + hh * 4; g = 128 + hh * 2; b = 66 + hh * 2; }
      else if (hh < 14) { r = 128 + (hh - 7) * 4; g = 128 - (hh - 7) * 2; b = 84 + (hh - 7) * 2; }
      else { r = 150; g = 142; b = 130; }
      const o = k * 4;
      img.data[o] = r * (hh < 0 ? 1 : shade); img.data[o + 1] = g * (hh < 0 ? 1 : shade); img.data[o + 2] = b * (hh < 0 ? 1 : shade); img.data[o + 3] = 255;
    }
    rctx.putImageData(img, 0, 0);
    heightOf = (x, z) => rawHeight(m, x, z);
    checkProblems();
  }
  function soon() { clearTimeout(reliefTimer); reliefTimer = setTimeout(() => { buildRelief(); draw(); }, 140); }

  // --- drawing --------------------------------------------------------------------------------
  const isSel = (s) => sel && JSON.stringify(sel) === JSON.stringify(s);
  function ring(x, z, r, color, width = 2, dash = null) {
    ctx.beginPath(); ctx.setLineDash(dash || []); ctx.lineWidth = width; ctx.strokeStyle = color;
    ctx.arc(toPx(x), toPx(z), Math.max(3, (r / (2 * MAP_HALF)) * SIZE), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  function dot(x, z, r, fill, stroke = null) {
    ctx.beginPath(); ctx.arc(toPx(x), toPx(z), r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function label(x, z, text, color = '#fff') {
    ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(text, toPx(x), toPx(z)); ctx.fillStyle = color; ctx.fillText(text, toPx(x), toPx(z));
  }
  function line(pts, color, width) {
    ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(toPx(x), toPx(z)) : ctx.moveTo(toPx(x), toPx(z)))); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
  }
  function draw() {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(relief, 0, 0, SIZE, SIZE);
    // the playable square
    ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(toPx(-MAP_LIMIT), toPx(-MAP_LIMIT), toPx(MAP_LIMIT) - toPx(-MAP_LIMIT), toPx(MAP_LIMIT) - toPx(-MAP_LIMIT)); ctx.setLineDash([]);
    const m = draft;
    m.roads.forEach((rd, ri) => { line(rd.points, '#b89a6a', 3); rd.points.forEach(([x, z], i) => { if (sel && sel.road === ri) dot(x, z, 4, '#e8d3a8', isSel({ road: ri, i }) ? '#ffd27a' : null); }); });
    line(m.river.points, 'rgba(150,210,240,0.9)', 2);
    m.river.points.forEach(([x, z], i) => dot(x, z, 4, isSel({ river: i }) ? '#ffd27a' : '#a8dcf4'));
    m.river.fords.forEach((f, i) => ring(f.x, f.z, f.r, isSel({ list: 'fords', i }) ? '#ffd27a' : '#bfe8f8', 2));
    m.lakes.forEach((l, i) => { ctx.beginPath(); ctx.ellipse(toPx(l.x), toPx(l.z), (l.rx / (2 * MAP_HALF)) * SIZE, (l.rz / (2 * MAP_HALF)) * SIZE, 0, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = isSel({ list: 'lakes', i }) ? '#ffd27a' : '#8fd0ee'; ctx.stroke(); });
    m.hills.forEach((hl, i) => { ring(hl.x, hl.z, hl.r, isSel({ list: 'hills', i }) ? '#ffd27a' : hl.h >= 0 ? 'rgba(255,250,235,0.7)' : 'rgba(40,30,20,0.8)', 1.5, [3, 3]); label(hl.x, hl.z, `${hl.h >= 0 ? '+' : ''}${hl.h}`); });
    m.flats.forEach((f, i) => ring(f.x, f.z, f.r, isSel({ list: 'flats', i }) ? '#ffd27a' : '#e6d6a8', 1.5, [8, 4]));
    m.forests.forEach((f, i) => { ctx.beginPath(); ctx.arc(toPx(f.x), toPx(f.z), (f.r / (2 * MAP_HALF)) * SIZE, 0, Math.PI * 2); ctx.fillStyle = 'rgba(30,80,30,0.45)'; ctx.fill(); ring(f.x, f.z, f.r, isSel({ list: 'forests', i }) ? '#ffd27a' : '#3f8a3f', 1.5); label(f.x, f.z, String(f.count), '#d8f0c8'); });
    m.rocks.forEach((c, i) => { dot(c.x, c.z, 4 + c.count, '#b8b4aa', isSel({ list: 'rocks', i }) ? '#ffd27a' : '#55524c'); });
    m.ironVeins.forEach((p, i) => dot(p.x, p.z, 6, '#e07a3a', isSel({ list: 'ironVeins', i }) ? '#ffd27a' : '#fff0dc'));
    m.saltPans.forEach((p, i) => dot(p.x, p.z, 6, '#f4f4ec', isSel({ list: 'saltPans', i }) ? '#ffd27a' : '#8a8a80'));
    m.pois.forEach((p, i) => { dot(p.x, p.z, 8, '#2a2f36', isSel({ list: 'pois', i }) ? '#ffd27a' : '#c9a45c'); label(p.x, p.z, p.type[0].toUpperCase(), '#f0d79a'); });
    for (const [seat, color, text] of [['playerStart', '#4fb0dc', 'You'], ['enemyCamp', '#e0604a', 'Foe']]) {
      const s = m[seat];
      ctx.fillStyle = color; ctx.fillRect(toPx(s.x) - 9, toPx(s.z) - 9, 18, 18);
      if (isSel({ seat })) { ctx.lineWidth = 3; ctx.strokeStyle = '#ffd27a'; ctx.strokeRect(toPx(s.x) - 11, toPx(s.z) - 11, 22, 22); }
      label(s.x, s.z + 9, text);
    }
  }

  // --- picking and editing --------------------------------------------------------------------
  function pick(x, z) {
    const near = (px, pz, r = 7) => Math.hypot(px - x, pz - z) <= r;
    for (const seat of ['playerStart', 'enemyCamp']) if (near(draft[seat].x, draft[seat].z, 9)) return { seat };
    for (let i = 0; i < draft.river.points.length; i++) if (near(...draft.river.points[i], 6)) return { river: i };
    for (let r = 0; r < draft.roads.length; r++) for (let i = 0; i < draft.roads[r].points.length; i++) if (near(...draft.roads[r].points[i], 6)) return { road: r, i };
    for (const list of ['pois', 'ironVeins', 'saltPans', 'rocks', 'fords', 'forests', 'lakes', 'flats', 'hills']) {
      const items = list === 'fords' ? draft.river.fords : draft[list];
      // smallest first: a forest on a hill picks the forest
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const r = list === 'lakes' ? Math.max(it.rx, it.rz) : it.r ?? (list === 'rocks' ? it.spread + 3 : 7);
        if (near(it.x, it.z, Math.max(7, r))) return { list, i };
      }
    }
    return null;
  }
  const listOf = (name) => (name === 'fords' ? draft.river.fords : draft[name]);
  function itemOf(s) { return s && s.list ? listOf(s.list)[s.i] : null; }
  function remove(s) {
    if (!s) return;
    if (s.list) listOf(s.list).splice(s.i, 1);
    else if (s.river != null) { if (draft.river.points.length > 2) draft.river.points.splice(s.river, 1); }
    else if (s.road != null) { draft.roads.splice(s.road, 1); activeRoad = null; }
    sel = null; changed(true);
  }
  function atLimit(name) { return listOf(name).length >= (name === 'fords' ? LIMITS.fords : LIMITS[name === 'ironVeins' ? 'iron' : name === 'saltPans' ? 'salt' : name]); }
  function add(name, item) {
    if (atLimit(name)) { status(`At most ${listOf(name).length} of these on a map.`); return null; }
    listOf(name).push(item);
    return { list: name, i: listOf(name).length - 1 };
  }
  function place(x, z) {
    const at = { x: clampC(x), z: clampC(z) };
    switch (tool) {
      case 'hill': return add('hills', { ...at, h: 7, r: 26 });
      case 'dip': return add('hills', { ...at, h: -3, r: 22 });
      case 'flat': return add('flats', { ...at, r: 16, h: 3.6 });
      case 'lake': return add('lakes', { ...at, rx: 20, rz: 15, bed: -1.6 });
      case 'ford': return add('fords', { ...at, r: 10 });
      case 'forest': return add('forests', { ...at, r: 14, count: 28 });
      case 'rocks': return add('rocks', { ...at, count: 4, spread: 6 });
      case 'iron': return add('ironVeins', at);
      case 'salt': return add('saltPans', at);
      case 'trader': case 'cairn': case 'ruin': case 'hamlet': return add('pois', { type: tool, ...at });
      case 'start': draft.playerStart = at; return { seat: 'playerStart' };
      case 'camp': draft.enemyCamp = at; return { seat: 'enemyCamp' };
      case 'river': {
        if (draft.river.points.length >= LIMITS.river) { status(`At most ${LIMITS.river} river points.`); return null; }
        // join the nearest stretch (or extend at the nearer end)
        const pts = draft.river.points;
        let best = 0, bd = Infinity;
        for (let i = 0; i + 1 < pts.length; i++) { const d = distToPolyline(at.x, at.z, [pts[i], pts[i + 1]]); if (d < bd) { bd = d; best = i + 1; } }
        const dEnd0 = Math.hypot(at.x - pts[0][0], at.z - pts[0][1]), dEnd1 = Math.hypot(at.x - pts[pts.length - 1][0], at.z - pts[pts.length - 1][1]);
        if (bd > 30) best = dEnd0 < dEnd1 ? 0 : pts.length;
        pts.splice(best, 0, [at.x, at.z]);
        return { river: best };
      }
      case 'road': {
        if (activeRoad == null) {
          if (draft.roads.length >= LIMITS.roads) { status(`At most ${LIMITS.roads} roads.`); return null; }
          draft.roads.push({ width: 2.8, points: [[at.x, at.z]] });
          activeRoad = draft.roads.length - 1;
        } else if (draft.roads[activeRoad].points.length < LIMITS.roadPoints) draft.roads[activeRoad].points.push([at.x, at.z]);
        return { road: activeRoad, i: draft.roads[activeRoad].points.length - 1 };
      }
      default: return null;
    }
  }
  function moveTo(s, x, z) {
    const at = [clampC(x), clampC(z)];
    if (s.seat) draft[s.seat] = { x: at[0], z: at[1] };
    else if (s.river != null) draft.river.points[s.river] = at;
    else if (s.road != null) draft.roads[s.road].points[s.i] = at;
    else { const it = itemOf(s); it.x = at[0]; it.z = at[1]; }
  }
  function endRoad() {
    if (activeRoad != null && draft.roads[activeRoad] && draft.roads[activeRoad].points.length < 2) draft.roads.splice(activeRoad, 1);
    activeRoad = null;
  }

  const pos = (ev) => { const r = canvas.getBoundingClientRect(); return [toM(((ev.clientX - r.left) / r.width) * SIZE), toM(((ev.clientY - r.top) / r.height) * SIZE)]; };
  canvas.addEventListener('contextmenu', (ev) => { ev.preventDefault(); endRoad(); draw(); });
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const [x, z] = pos(ev);
    if (tool === 'select') { sel = pick(x, z); if (sel) { drag = sel; canvas.setPointerCapture(ev.pointerId); } renderPanel(); draw(); return; }
    if (tool === 'erase') { remove(pick(x, z)); return; }
    if (tool !== 'road') endRoad();
    const s = place(x, z);
    if (s) { sel = s; drag = tool === 'road' ? null : s; changed(true); }
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => { if (!drag) return; const [x, z] = pos(ev); moveTo(drag, x, z); changed(drag.seat || drag.river != null || drag.list === 'hills' || drag.list === 'flats' || drag.list === 'lakes' || drag.list === 'fords'); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (ev) => {
    const it = itemOf(sel);
    if (!it) return;
    ev.preventDefault();
    const up = ev.deltaY < 0 ? 1 : -1;
    if (ev.shiftKey) { if ('h' in it) it.h = Math.round((it.h + up * 0.5) * 10) / 10; else if ('count' in it) it.count = Math.max(1, it.count + up * (sel.list === 'forests' ? 4 : 1)); }
    else if ('r' in it) it.r = Math.max(4, it.r + up * 2);
    else if ('rx' in it) { it.rx = Math.max(6, it.rx + up * 2); it.rz = Math.max(6, it.rz + up * 2); }
    else if ('spread' in it) it.spread = Math.max(2, it.spread + up);
    changed(sel.list === 'hills' || sel.list === 'flats' || sel.list === 'lakes' || sel.list === 'fords');
  }, { passive: false });

  // --- panel ------------------------------------------------------------------------------------
  const statusEl = h('p.ed-status', { role: 'status' });
  const problemsEl = h('div.ed-problems');
  const propsEl = h('div.ed-props');
  const nameIn = h('input.ed-name', { type: 'text', maxlength: '32', 'aria-label': 'Map name', value: draft.name || '' });
  nameIn.addEventListener('input', () => { draft.name = nameIn.value; dirty = true; });
  function status(t) { statusEl.textContent = t; }
  function slider(labelText, value, min, max, step, onInput) {
    const out = h('output', { text: String(value) });
    const inp = h('input', { type: 'range', min, max, step, value, 'aria-label': labelText });
    inp.addEventListener('input', () => { out.textContent = inp.value; onInput(Number(inp.value)); });
    return h('label.ed-slider', {}, [h('span', { text: labelText }), inp, out]);
  }
  function renderPanel() {
    clear(propsEl);
    const it = itemOf(sel);
    const terrainEdit = (fn) => (v) => { fn(v); changed(true); };
    const plainEdit = (fn) => (v) => { fn(v); changed(false); };
    if (!sel) { propsEl.append(h('p.small.muted', { text: TOOLS.find((t) => t[0] === tool)[3] })); return; }
    const kind = sel.seat ? (sel.seat === 'playerStart' ? 'Your Keep' : 'Enemy seat') : sel.river != null ? 'River point' : sel.road != null ? 'Road' : sel.list === 'pois' ? it.type[0].toUpperCase() + it.type.slice(1) : sel.list === 'hills' ? (it.h >= 0 ? 'Hill' : 'Hollow') : (TOOLS.find((t) => t[0] === KIND_OF[sel.list]) || [0, sel.list])[1];
    propsEl.append(h('h3', { text: kind }));
    if (it && 'h' in it && sel.list === 'hills') propsEl.append(slider('Height', it.h, -6, 18, 0.5, terrainEdit((v) => { it.h = v; })));
    if (it && 'h' in it && sel.list === 'flats') propsEl.append(slider('Level', it.h, 1, 8, 0.1, terrainEdit((v) => { it.h = v; })));
    if (it && 'r' in it) propsEl.append(slider('Radius', it.r, sel.list === 'fords' ? 6 : 4, sel.list === 'hills' ? 60 : sel.list === 'flats' ? 40 : sel.list === 'fords' ? 14 : 30, 1, (sel.list === 'forests' ? plainEdit : terrainEdit)((v) => { it.r = v; })));
    if (it && 'rx' in it) { propsEl.append(slider('Width', it.rx, 8, 50, 1, terrainEdit((v) => { it.rx = v; }))); propsEl.append(slider('Depth (north–south)', it.rz, 8, 50, 1, terrainEdit((v) => { it.rz = v; }))); }
    if (it && 'count' in it) propsEl.append(slider(sel.list === 'forests' ? 'Trees' : 'Outcrops', it.count, 1, sel.list === 'forests' ? 90 : 8, 1, plainEdit((v) => { it.count = v; })));
    if (it && 'spread' in it) propsEl.append(slider('Spread', it.spread, 2, 10, 0.5, plainEdit((v) => { it.spread = v; })));
    if (it && sel.list === 'pois') {
      const inp = h('input.ed-name', { type: 'text', maxlength: '32', value: it.label || '', placeholder: 'Name (optional)', 'aria-label': 'Place name' });
      inp.addEventListener('input', () => { it.label = inp.value; dirty = true; });
      propsEl.append(inp);
    }
    if (sel.road != null) propsEl.append(h('p.small.muted', { text: activeRoad === sel.road ? 'Click to add points; Esc or right-click ends the road.' : 'Drag a point to move it.' }));
    if (!sel.seat) propsEl.append(h('button.btn', { type: 'button', text: 'Remove', onclick: () => remove(sel) }));
  }
  function checkProblems() {
    const m = full();
    const { errors, warnings } = mapProblems(m, heightOf);
    clear(problemsEl);
    if (!errors.length && !warnings.length) problemsEl.append(h('p.ed-ok', { text: 'Playable: both seats have land, wood, stone and iron in reach.' }));
    for (const e of errors) problemsEl.append(h('p.ed-error', { text: e }));
    for (const w of warnings) problemsEl.append(h('p.ed-warn', { text: w }));
    return errors;
  }
  function changed(terrain) {
    dirty = true;
    renderPanel();
    if (terrain) soon(); else { checkProblems(); }
    draw();
  }

  // --- actions ----------------------------------------------------------------------------------
  const dialog = h('div.ed-dialog', { hidden: true, role: 'dialog' });
  function openDialog(title, body) { clear(dialog); dialog.append(h('div.ed-dialog-card.panel', {}, [h('h3', { text: title }), ...body, h('button.btn', { type: 'button', text: 'Close', onclick: () => { dialog.hidden = true; } })])); dialog.hidden = false; }
  function load(map, newId = null) { draft = toDraft(map); id = newId; sel = null; activeRoad = null; nameIn.value = draft.name || ''; reliefKey = ''; dirty = false; buildRelief(); renderPanel(); draw(); }
  function doSave() {
    const errors = checkProblems();
    try { id = saveMap(full(), id); dirty = false; status(errors.length ? 'Saved (not yet playable: see the list).' : 'Saved.'); return true; }
    catch (err) { status(err.message); return false; }
  }
  function doPlay() {
    const errors = checkProblems();
    if (errors.length) { status('Not playable yet: see the list on the right.'); return; }
    if (!doSave()) return;
    onPlay(validateMap(full()), id);
  }
  function newDialog() {
    const seedIn = h('input.ed-name', { type: 'text', maxlength: '16', placeholder: 'seed', value: String(Math.floor(Date.now() % 100000)), 'aria-label': 'Random valley seed' });
    openDialog('New map', [
      h('button.menu-btn', { type: 'button', text: 'Blank valley', onclick: () => { load(blankMap()); dialog.hidden = true; } }),
      ...Object.entries({ harrowmere: 'Harrowmere Valley', saltmere: 'The Saltmere', whitehart: 'Whitehart Vale', ironmarch: 'The Iron March' }).map(([k, n]) => h('button.menu-btn', { type: 'button', text: `Copy of ${n}`, onclick: () => { load(mapFrom(MAPS[k], `My ${n}`)); dialog.hidden = true; } })),
      h('div.ed-row', {}, [seedIn, h('button.menu-btn', { type: 'button', text: 'Copy of a random valley', onclick: () => { load(mapFrom(generateWildMap(seedIn.value || '1'), `Valley ${seedIn.value}`)); dialog.hidden = true; } })]),
    ]);
  }
  function mapsDialog() {
    const maps = listMaps();
    openDialog(`Your maps (${maps.length}/${MAX_MAPS})`, maps.length ? maps.map((e) => h('div.ed-row', {}, [
      h('span.ed-mapname', { text: e.map.name }),
      h('button.btn', { type: 'button', text: 'Open', onclick: () => { load(e.map, e.id); dialog.hidden = true; } }),
      h('button.btn', { type: 'button', text: 'Delete', onclick: () => { deleteMap(e.id); if (id === e.id) id = null; mapsDialog(); } }),
    ])) : [h('p.muted', { text: 'No maps saved yet.' })]);
  }
  function exportDialog() {
    let text = '';
    try { text = exportMap(full()); } catch (err) { status(err.message); return; }
    const ta = h('textarea.ed-text', { readonly: true, rows: '6', 'aria-label': 'Exported map' });
    ta.value = text;
    openDialog('Export: share this text', [ta, h('button.btn', { type: 'button', text: 'Copy', onclick: () => { ta.select(); try { navigator.clipboard.writeText(text); status('Copied.'); } catch { status('Select the text and copy it.'); } } })]);
  }
  function importDialog() {
    const ta = h('textarea.ed-text', { rows: '6', placeholder: 'Paste an exported map here', 'aria-label': 'Map to import' });
    const msg = h('p.ed-error');
    openDialog('Import a map', [ta, msg, h('button.btn', { type: 'button', text: 'Open it', onclick: () => { try { load(importMap(ta.value)); dialog.hidden = true; status('Imported: save it to keep it.'); dirty = true; } catch (err) { msg.textContent = err.message; } } })]);
  }

  const toolBtns = h('div.ed-tools', { role: 'toolbar', 'aria-label': 'Map tools' });
  let lastGroup = null;
  for (const [tid, name, group, hint] of TOOLS) {
    if (group !== lastGroup) { toolBtns.append(h('div.ed-group', { text: group })); lastGroup = group; }
    const b = h(`button.ed-tool${tid === tool ? '.active' : ''}`, { type: 'button', text: name, 'data-tip': hint, 'aria-pressed': tid === tool ? 'true' : 'false', title: hint });
    b.addEventListener('click', () => {
      endRoad(); tool = tid; if (tid !== 'select') sel = null;
      for (const o of toolBtns.querySelectorAll('.ed-tool')) { o.classList.toggle('active', o === b); o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }
      renderPanel(); draw();
    });
    toolBtns.append(b);
  }
  const terrainBox = h('div.ed-terrain', {}, [
    h('h3', { text: 'Land' }),
    slider('Base height', draft.baseHeight, 1.5, 6, 0.1, (v) => { draft.baseHeight = v; changed(true); }),
    slider('Roughness', draft.noiseAmp, 0, 9, 0.5, (v) => { draft.noiseAmp = v; changed(true); }),
    h('button.btn', { type: 'button', text: 'New ground pattern', onclick: () => { draft.noiseSeed = 1 + ((draft.noiseSeed * 7919 + 13) % 99998); changed(true); } }),
  ]);
  const el = h('div.map-editor', {}, [
    h('div.ed-left', {}, [toolBtns]),
    h('div.ed-center', {}, [canvas, statusEl]),
    h('div.ed-right.panel', {}, [
      h('label.ed-label', { text: 'Name' }), nameIn,
      propsEl, terrainBox,
      h('h3', { text: 'Check' }), problemsEl,
      h('div.ed-actions', {}, [
        h('button.menu-btn.primary', { type: 'button', text: 'Play this map', onclick: doPlay }),
        h('button.btn', { type: 'button', text: 'Save', onclick: doSave }),
        h('button.btn', { type: 'button', text: 'New…', onclick: newDialog }),
        h('button.btn', { type: 'button', text: 'Your maps…', onclick: mapsDialog }),
        h('button.btn', { type: 'button', text: 'Export…', onclick: exportDialog }),
        h('button.btn', { type: 'button', text: 'Import…', onclick: importDialog }),
        h('button.btn', { type: 'button', text: 'Back', onclick: () => { if (dirty && !window.confirm('Leave without saving?')) return; onBack(); } }),
      ]),
    ]),
    dialog,
  ]);
  el.addEventListener('keydown', (ev) => {
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel && !sel.seat) { ev.preventDefault(); remove(sel); }
    if (ev.key === 'Escape') { ev.stopPropagation(); if (!dialog.hidden) dialog.hidden = true; else { endRoad(); sel = null; renderPanel(); draw(); } }
  });
  el.tabIndex = -1;

  buildRelief(); renderPanel(); draw();
  return { el, get map() { return full(); }, load };
}
