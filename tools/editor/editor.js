/* Hitbox Editor — animation-centric. Groups the game's per-state sprites into
   animations, plays them, and edits per-frame hit/hurt/attack/collision boxes.
   Reads the real IMG_SPRITES/HITBOXES from a hidden game iframe; POSTs to /api/save. */
"use strict";

const KINDS = ["hurt", "coll", "attack"];
const COL = { hurt: "#4ade80", coll: "#60a5fa", attack: "#f87171" };
const KIND_HINT = {
  hurt: "Where this fighter can be hit (body).",
  coll: "Body-vs-body push box.",
  attack: "Deals a hit while active (the t0–t1 window of the move)."
};

const G = {
  win: null, IMG: null, chars: [], char: null,
  anims: [], anim: null, frameIdx: 0,
  kind: "hurt",
  data: { hitboxes: {}, spriteAlign: {}, charScale: {}, animFps: {}, charAnimSpeed: {}, animTScale: {}, charStats: {} },
  charDefaults: {},
  map: {
    win: null,                                   // the #mapGame iframe's window (loaded WITHOUT ?tool=1)
    anchors: {}, base: { wallL: 20, wallR: 2012, worldW: 2032 }, objects: {}, limits: {},
    world: { W: 720, H: 270, WORLD_W: 2032 },    // authoritative game viewport/world (read from #mapGame)
    cam: { camX: 0, camTop: 0, scale: 0.35 },    // editor-only view transform (drives the game's map camera)
    fitScale: 0.35,                              // scale at "Fit Stage" (== 100% zoom reference)
    sel: null, drag: null, pan: null, spaceDown: false, started: false, dpr: 1, diag: false
  },
  view: { z: 3.6, cx: 0, fy: 0 },
  drag: null, dpr: 1,
  playing: false, speed: 1, fps: 10, onion: false, _acc: 0, _last: 0
};

const $ = id => document.getElementById(id);
const cvs = $("view"), ctx = cvs.getContext("2d");
const isFrame = v => v && typeof v === "object" && typeof v.w === "number" && (v.src || v.img);
function gEval(expr) { try { return G.win.eval(expr); } catch (e) { return undefined; } }

/* ---------------- boot ---------------- */
function boot() {
  const frame = $("game");
  const tryInit = () => {
    try {
      const w = frame.contentWindow;
      const IMG = w && w.eval ? w.eval("typeof IMG_SPRITES!=='undefined' ? IMG_SPRITES : null") : null;
      if (IMG && Object.keys(IMG).length) { init(w, IMG); return; }
    } catch (e) {}
    setTimeout(tryInit, 150);
  };
  frame.addEventListener("load", tryInit); tryInit();
}
function init(w, IMG) {
  const first = !G.win, prevChar = G.char;   // preserve selection if init re-runs on a second iframe load
  G.win = w; G.IMG = IMG;
  const HB = gEval("typeof HITBOXES!=='undefined' ? HITBOXES : {}") || {};
  const SA = gEval("typeof SPRITE_ALIGN!=='undefined' ? SPRITE_ALIGN : {}") || {};
  const CS = gEval("typeof CHAR_SCALE!=='undefined' ? CHAR_SCALE : {}") || {};
  const AS = gEval("typeof CHAR_ANIM_SPEED!=='undefined' ? CHAR_ANIM_SPEED : {}") || {};
  const AF = gEval("typeof ANIM_FPS!=='undefined' ? ANIM_FPS : {}") || {};
  try { G.data.hitboxes = JSON.parse(JSON.stringify(HB)); } catch (e) { G.data.hitboxes = {}; }
  try { G.data.spriteAlign = JSON.parse(JSON.stringify(SA)); } catch (e) { G.data.spriteAlign = {}; }
  try { G.data.charScale = JSON.parse(JSON.stringify(CS)); } catch (e) { G.data.charScale = {}; }
  try { G.data.charAnimSpeed = JSON.parse(JSON.stringify(AS)); } catch (e) { G.data.charAnimSpeed = {}; }
  try { G.data.animFps = JSON.parse(JSON.stringify(AF)); } catch (e) { G.data.animFps = {}; }
  const ST = gEval("typeof CHAR_STATS!=='undefined' ? CHAR_STATS : {}") || {};
  try { G.data.charStats = JSON.parse(JSON.stringify(ST)); } catch (e) { G.data.charStats = {}; }
  // the characters' ORIGINAL stats (for the "def" hints + Reset) — from _CHAR_STATS_ORIG if applied, else current CHARS
  G.charDefaults = gEval("(function(){ if(typeof CHARS==='undefined')return{}; var o={},g=(typeof _CHAR_STATS_ORIG!=='undefined'&&_CHAR_STATS_ORIG)||null; for(var i=0;i<CHARS.length;i++){var c=CHARS[i],s=g&&g[c.id]; o[c.id]=s?{hp:s.hp,armor:s.armor,speed:s.speed,jump:s.jump,power:s.power}:{hp:c.hp,armor:c.armor,speed:c.speed,jump:c.jump,power:c.power};} return o; })()") || {};
  // map editor: object anchors + pristine world limits + any saved overrides
  G.map.anchors = gEval("typeof MAP_ANCHORS!=='undefined' ? MAP_ANCHORS : {}") || {};
  G.map.base = gEval("typeof MAP_LIMIT_BASE!=='undefined' ? MAP_LIMIT_BASE : {wallL:20,wallR:2012,worldW:2032}") || { wallL: 20, wallR: 2012, worldW: 2032 };
  try { G.map.objects = JSON.parse(JSON.stringify(gEval("(typeof MAP_DATA!=='undefined'&&MAP_DATA.objects)||{}") || {})); } catch (e) { G.map.objects = {}; }
  try { G.map.limits = JSON.parse(JSON.stringify(gEval("(typeof MAP_DATA!=='undefined'&&MAP_DATA.limits)||{}") || {})); } catch (e) { G.map.limits = {}; }
  buildCharList();
  if (prevChar && G.chars.includes(prevChar)) { G.char = prevChar; $("charSel").value = prevChar; buildAnimList(); }
  syncStats();
  $("loading").style.display = "none";
  if (first) requestAnimationFrame(tick);   // don't stack a second render loop on re-init
  primeArena();                             // leave the title menu immediately -> frozen clean arena
}

/* ---------------- animation grouping ---------------- */
function natKey(suf) {
  const n = parseInt(suf, 10); const num = isNaN(n) ? (suf === "" ? -1 : 0) : n;
  const lt = (suf.match(/[a-z]$/i) || [""])[0]; return [num, lt];
}
function deriveAnimations(char) {
  const set = G.IMG[char] || {}, keys = Object.keys(set).filter(k => isFrame(set[k]));
  const groups = {};
  for (const k of keys) {
    const m = k.match(/^(.*?)(\d+[a-z]?|)$/i); let base = (m && m[1]) || k, suf = (m && m[2]) || "";
    if (!base) { base = k; suf = ""; }
    (groups[base] = groups[base] || []).push({ key: k, suf });
  }
  const anims = [];
  for (const base in groups) {
    const frames = groups[base].sort((a, b) => { const A = natKey(a.suf), B = natKey(b.suf); return A[0] - B[0] || A[1].localeCompare(B[1]); }).map(x => x.key);
    anims.push({ name: base, frames, fps: 10 });
  }
  anims.sort((a, b) => (b.frames.length > 1) - (a.frames.length > 1) || a.name.localeCompare(b.name));
  return anims;
}

/* ---------------- lists ---------------- */
function buildCharList() {
  G.chars = Object.keys(G.IMG).filter(id => { const s = G.IMG[id]; return s && typeof s === "object" && Object.keys(s).some(k => isFrame(s[k])); });
  const sel = $("charSel"); sel.innerHTML = "";
  for (const c of G.chars) { const o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o); }
  G.char = G.chars[0]; sel.value = G.char; buildAnimList();
}
/* Friendly display names for the code prefixes (falls back to a prettified version of the raw key). */
const ANIM_LABELS = {
  idle: "Idle", run: "Run", walk: "Walk", jump: "Jump", dbljump: "Double Jump", landing: "Landing",
  crouch: "Crouch", block: "Block", blockhit: "Block — Hit", cblock: "Crouch Block", cblockhit: "Crouch Block — Hit", airblock: "Air Block",
  atk: "Basic Attack", catk: "Crouch Attack", airatk: "Air Attack",
  skA: "Skill A", skAair: "Skill A — Air", skAcr: "Skill A — Crouch",
  skB: "Skill B", skBair: "Skill B — Air", cskB: "Crouch Skill B", cskC: "Crouch Skill C",
  hit: "Hit", hitlow: "Hit — Low", crouchhit: "Crouch — Hit", damageair: "Air Damage", falldmg: "Fall Damage",
  kb: "Knockback", ko: "KO", ult: "Ultimate", skill: "Skill", dblfx: "Double-Jump FX"
};
function labelFor(name) {
  return ANIM_LABELS[name] || name.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
}
function buildAnimList() {
  G.anims = deriveAnimations(G.char);
  const sel = $("animSel"); sel.innerHTML = "";
  G.anims.forEach((a, i) => {
    const o = document.createElement("option"); o.value = i;
    o.textContent = labelFor(a.name) + "  ·  " + a.frames.length + (a.frames.length === 1 ? " frame" : " frames");
    o.title = "sprite key: " + a.name;   // the raw code prefix, for reference
    sel.appendChild(o);
  });
  selectAnim(0);
}
/* Recommend an fps from the frame count: aim for a ~0.5s cycle, clamped to a natural 6–20 range.
   Roughly 2 fps per frame — more frames play smoother/faster, fewer frames slower so each pose reads.
   The recommendation is also the "natural speed" baseline: at rec fps, the in-game timing is unchanged. */
function recommendFps(frames) { return frames <= 1 ? null : Math.max(6, Math.min(20, Math.round(frames / 0.5))); }
function macroOf(char) { const v = G.data.charAnimSpeed[char]; return (v > 0) ? v : 1; }
function getAnimFps(name) { const c = G.data.animFps[G.char]; const v = c && c[name]; return (v > 0) ? v : null; }
function setAnimFpsVal(name, fps) { if (!G.data.animFps[G.char]) G.data.animFps[G.char] = {}; G.data.animFps[G.char][name] = fps; }
function clearAnimFps(name) { if (G.data.animFps[G.char]) delete G.data.animFps[G.char][name]; }
function updateFpsRec() {
  const rec = recommendFps(G.anim ? G.anim.frames.length : 0), b = $("fpsRec");
  if (!b) return;
  if (rec == null) { b.textContent = "static"; b.disabled = true; }
  else { b.textContent = "rec " + rec; b.disabled = (G.fps === rec); }
}
function syncAnimSpeed() { const m = macroOf(G.char); $("animSpeed").value = m; $("animSpeedNum").value = +m.toFixed(2); $("asVal").textContent = m.toFixed(2) + "×"; }
function setAnimSpeed(v) { v = Math.max(0.3, Math.min(3, v || 1)); G.data.charAnimSpeed[G.char] = v; syncAnimSpeed(); }
function selectAnim(i) {
  G.anim = G.anims[i] || G.anims[0]; G.frameIdx = 0;
  const rec = recommendFps(G.anim.frames.length), ov = getAnimFps(G.anim.name);
  G.fps = ov || rec || 10; G.anim.fps = G.fps;
  $("fps").value = G.fps; $("animSel").value = String(i);
  buildStrip(); syncSidebar(); syncCharSize(); syncAnimSpeed(); updateFpsRec();
}
/* Flatten macro × micro into the per-state TIME-SCALE the engine reads (1 = natural speed = no change). */
function buildTScale() {
  const out = {};
  for (const char of Object.keys(G.IMG)) {
    const set = G.IMG[char]; if (!(set && typeof set === "object" && Object.keys(set).some(k => isFrame(set[k])))) continue;
    const macro = macroOf(char), map = {};
    for (const a of deriveAnimations(char)) {
      if (a.frames.length <= 1) continue;
      const rec = recommendFps(a.frames.length) || 10;
      const fps = (G.data.animFps[char] && G.data.animFps[char][a.name]) || rec;
      const ts = (fps / rec) * macro;
      if (Math.abs(ts - 1) < 0.002) continue;                 // no-op -> keep the file clean
      for (const key of a.frames) map[key] = +ts.toFixed(4);
    }
    if (Object.keys(map).length) out[char] = map;
  }
  G.data.animTScale = out;
}
function syncCharSize() {
  const cs = csCur();
  $("charScale").value = cs; $("charScaleNum").value = +cs.toFixed(2); $("csVal").textContent = cs.toFixed(2) + "×";
}
function setCharSize(v) {
  v = Math.max(0.3, Math.min(3, v || 1));
  G.data.charScale[G.char] = v; syncCharSize();
}
function stateKey() { return G.anim ? G.anim.frames[G.frameIdx] : null; }

/* ---------------- data access ---------------- */
function csOf(char) { const v = G.data.charScale[char]; return (v > 0) ? v : 1; }
function csCur() { return csOf(G.char); }
function frameObj(char, key) { const set = G.IMG[char]; return set ? set[key] : null; }
function align(char, key) { return (G.data.spriteAlign[char] && G.data.spriteAlign[char][key]) || null; }
function effFrame(char, key) {
  const fr = frameObj(char, key); if (!fr) return null; const a = align(char, key) || {};
  return { img: fr.img, w: a.w != null ? a.w : fr.w, h: a.h != null ? a.h : fr.h, dx: a.dx != null ? a.dx : (fr.dx || 0), foot: a.foot != null ? a.foot : (fr.foot || 0) };
}
function recFor(char, key, create) {
  if (!G.data.hitboxes[char]) { if (!create) return null; G.data.hitboxes[char] = {}; }
  if (!G.data.hitboxes[char][key]) { if (!create) return null; G.data.hitboxes[char][key] = {}; }
  return G.data.hitboxes[char][key];
}
function rec(create) { return recFor(G.char, stateKey(), create); }
function box() { const r = rec(false); return r ? r[G.kind] : null; }
function setBox(b) { const r = rec(true); if (b) r[G.kind] = b; else delete r[G.kind]; }

/* ---------------- view transforms ---------------- */
function layout() {
  const rect = cvs.getBoundingClientRect(); G.dpr = window.devicePixelRatio || 1;
  cvs.width = Math.round(rect.width * G.dpr); cvs.height = Math.round(rect.height * G.dpr);
  G.view.cx = rect.width * 0.42; G.view.fy = rect.height * 0.82; return { w: rect.width, h: rect.height };
}
function boxRect(b) { const v = G.view, z = v.z * csCur(); return { x: v.cx + z * b.x, y: v.fy - z * (b.y + b.h), w: z * b.w, h: z * b.h }; }
function ptToBox(sx, sy) { const v = G.view, z = v.z * csCur(); return { x: (sx - v.cx) / z, y: (v.fy - sy) / z }; }
function handles(r) { return [{ n: "nw", x: r.x, y: r.y }, { n: "ne", x: r.x + r.w, y: r.y }, { n: "sw", x: r.x, y: r.y + r.h }, { n: "se", x: r.x + r.w, y: r.y + r.h }]; }

/* ---------------- main loop ---------------- */
function tick(now) {
  if (G.playing && G.anim && G.anim.frames.length > 1) {
    const dt = now - (G._last || now); G._acc += dt;
    const interval = 1000 / Math.max(1, G.fps * G.speed * macroOf(G.char));
    let advanced = false;
    while (G._acc >= interval) { G._acc -= interval; G.frameIdx = (G.frameIdx + 1) % G.anim.frames.length; advanced = true; }
    if (advanced) { refreshStrip(); syncSidebar(); }
  }
  G._last = now;
  render();
  requestAnimationFrame(tick);
}
function render() {
  const { w, h } = layout(); ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const v = G.view;
  ctx.strokeStyle = "rgba(120,110,170,0.09)"; ctx.lineWidth = 1; ctx.beginPath();
  for (let gx = -30; gx <= 40; gx += 10) { const X = v.cx + v.z * gx; ctx.moveTo(X, 0); ctx.lineTo(X, h); }
  for (let gy = 0; gy <= 120; gy += 10) { const Y = v.fy - v.z * gy; ctx.moveTo(0, Y); ctx.lineTo(w, Y); }
  ctx.stroke();
  ctx.strokeStyle = "rgba(200,190,240,0.30)"; ctx.beginPath(); ctx.moveTo(0, v.fy); ctx.lineTo(w, v.fy); ctx.stroke();
  ctx.strokeStyle = "rgba(200,190,240,0.14)"; ctx.beginPath(); ctx.moveTo(v.cx, 0); ctx.lineTo(v.cx, h); ctx.stroke();

  const frames = G.anim ? G.anim.frames : [];
  // onion skin: previous + next frame, faint
  if (G.onion && frames.length > 1) {
    drawSprite(G.char, frames[(G.frameIdx - 1 + frames.length) % frames.length], v.cx, 0.18);
    drawSprite(G.char, frames[(G.frameIdx + 1) % frames.length], v.cx, 0.18);
  } else {
    const other = G.chars[(G.chars.indexOf(G.char) + 1) % G.chars.length];
    drawSprite(other, "idle", v.cx + v.z * 46, 0.14);
  }
  drawSprite(G.char, stateKey(), v.cx, 1);

  const r = rec(false);
  if (r) for (const k of KINDS) if (r[k]) drawBox(k, r[k], k === G.kind);
}
function drawSprite(char, key, cx, alpha) {
  const fr = effFrame(char, key); if (!fr || !fr.img || !fr.img.complete || !fr.img.naturalWidth) return;
  const hires = fr.img.naturalWidth > fr.w * 2, z = G.view.z * csOf(char);
  ctx.save(); ctx.translate(cx, G.view.fy); ctx.scale(z, z);
  ctx.imageSmoothingEnabled = hires; if (hires) ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = alpha;
  ctx.drawImage(fr.img, Math.round(-fr.w / 2 + fr.dx), Math.round(-fr.h + fr.foot), fr.w, fr.h);
  ctx.restore();
}
function drawBox(kind, b, active) {
  const r = boxRect(b), c = COL[kind];
  ctx.globalAlpha = active ? 1 : 0.45; ctx.fillStyle = c + "22"; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = c; ctx.lineWidth = active ? 2 : 1; ctx.strokeRect(r.x, r.y, r.w, r.h);
  if (active) { ctx.fillStyle = c; for (const hd of handles(r)) ctx.fillRect(hd.x - 4, hd.y - 4, 8, 8); }
  ctx.globalAlpha = 1;
}

/* ---------------- frame strip ---------------- */
function drawThumb(c, key) {
  const g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
  const fr = effFrame(G.char, key); if (!fr || !fr.img || !fr.img.complete || !fr.img.naturalWidth) return;
  const pad = 8, s = Math.min((c.width - pad * 2) / fr.w, (c.height - pad * 2) / fr.h);
  g.imageSmoothingEnabled = fr.img.naturalWidth > fr.w * 2; if (g.imageSmoothingEnabled) g.imageSmoothingQuality = "high";
  g.save(); g.translate(c.width / 2, c.height - pad); g.scale(s, s);
  g.drawImage(fr.img, Math.round(-fr.w / 2 + fr.dx), Math.round(-fr.h + fr.foot), fr.w, fr.h); g.restore();
}
function buildStrip() {
  const strip = $("strip"); strip.innerHTML = "";
  G.anim.frames.forEach((key, idx) => {
    const t = document.createElement("div"); t.className = "thumb"; t.dataset.idx = idx;
    const c = document.createElement("canvas"); c.width = 112; c.height = 128; drawThumb(c, key);
    const no = document.createElement("div"); no.className = "fno"; no.textContent = idx + 1;
    const dots = document.createElement("div"); dots.className = "dots";
    t.append(c, no, dots);
    t.title = key;
    t.addEventListener("click", () => { setPlaying(false); G.frameIdx = idx; refreshStrip(); syncSidebar(); });
    strip.appendChild(t);
  });
  refreshStrip();
}
function refreshStrip() {
  const strip = $("strip"); if (!strip.children.length) return;
  [...strip.children].forEach((t, idx) => {
    t.classList.toggle("on", idx === G.frameIdx);
    const key = G.anim.frames[idx], r = (G.data.hitboxes[G.char] && G.data.hitboxes[G.char][key]) || null;
    const dots = t.querySelector(".dots"); dots.innerHTML = "";
    if (r) for (const k of KINDS) if (r[k]) { const i = document.createElement("i"); i.style.background = COL[k]; dots.appendChild(i); }
  });
  $("frameReadout").textContent = "frame " + (G.frameIdx + 1) + " / " + G.anim.frames.length + "  ·  " + stateKey();
  const cur = strip.children[G.frameIdx]; if (cur) cur.scrollIntoView({ inline: "nearest", block: "nearest" });
}

/* ---------------- transport ---------------- */
function setPlaying(on) { G.playing = on; const b = $("playBtn"); b.classList.toggle("playing", on); b.textContent = on ? "❚❚ Pause" : "▶ Play"; }
function stepFrame(d) { setPlaying(false); const n = G.anim.frames.length; G.frameIdx = (G.frameIdx + d + n) % n; refreshStrip(); syncSidebar(); }
$("prevBtn").addEventListener("click", () => stepFrame(-1));
$("nextBtn").addEventListener("click", () => stepFrame(1));
$("playBtn").addEventListener("click", () => setPlaying(!G.playing));
for (const s of document.querySelectorAll(".sbtn")) s.addEventListener("click", () => {
  G.speed = +s.dataset.speed; for (const o of document.querySelectorAll(".sbtn")) o.classList.toggle("on", o === s);
});
$("fps").addEventListener("input", () => {
  G.fps = Math.max(1, +$("fps").value || 10); if (G.anim) G.anim.fps = G.fps;
  setAnimFpsVal(G.anim.name, G.fps); updateFpsRec();
});
$("fpsRec").addEventListener("click", () => {
  const rec = recommendFps(G.anim ? G.anim.frames.length : 0); if (rec == null) return;
  G.fps = rec; G.anim.fps = rec; $("fps").value = rec; clearAnimFps(G.anim.name); updateFpsRec();   // back on the recommendation
});
$("animSpeed").addEventListener("input", () => setAnimSpeed(+$("animSpeed").value));
$("animSpeedNum").addEventListener("input", () => setAnimSpeed(+$("animSpeedNum").value));
$("asReset").addEventListener("click", () => setAnimSpeed(1));
$("onion").addEventListener("change", e => { G.onion = e.target.checked; });

/* ---------------- mouse ---------------- */
function mpos(e) { const rect = cvs.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
cvs.addEventListener("mousedown", e => {
  const m = mpos(e), b = box();
  if (b) {
    const r = boxRect(b);
    for (const hd of handles(r)) if (Math.abs(m.x - hd.x) <= 6 && Math.abs(m.y - hd.y) <= 6) { G.drag = { mode: "resize", handle: hd.n, box: b }; return; }
    if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) { const p = ptToBox(m.x, m.y); G.drag = { mode: "move", box: b, ox: p.x - b.x, oy: p.y - b.y }; return; }
  }
  const p = ptToBox(m.x, m.y); G.drag = { mode: "new", ax: p.x, ay: p.y }; setPlaying(false);
});
window.addEventListener("mousemove", e => {
  if (!G.drag) return; const m = mpos(e), p = ptToBox(m.x, m.y), d = G.drag;
  if (d.mode === "new") {
    const nb = { x: Math.min(d.ax, p.x), y: Math.min(d.ay, p.y), w: Math.abs(p.x - d.ax), h: Math.abs(p.y - d.ay) };
    if (G.kind === "attack") { nb.t0 = 0; nb.t1 = 0.2; } setBox(nb);
  } else if (d.mode === "move") { d.box.x = p.x - d.ox; d.box.y = p.y - d.oy; }
  else if (d.mode === "resize") {
    const b = d.box, x2 = b.x + b.w, y2 = b.y + b.h;
    if (d.handle.includes("w")) { b.w = x2 - p.x; b.x = p.x; } if (d.handle.includes("e")) { b.w = p.x - b.x; }
    if (d.handle.includes("s")) { b.h = y2 - p.y; b.y = p.y; } if (d.handle.includes("n")) { b.h = p.y - b.y; }
    if (b.w < 0) { b.x += b.w; b.w = -b.w; } if (b.h < 0) { b.y += b.h; b.h = -b.h; }
  }
  syncSidebar();
});
window.addEventListener("mouseup", () => { if (!G.drag) return; const b = box(); if (b && (b.w < 0.5 || b.h < 0.5)) setBox(null); G.drag = null; refreshStrip(); syncSidebar(); });
cvs.addEventListener("wheel", e => { e.preventDefault(); G.view.z = Math.max(1.2, Math.min(10, G.view.z * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });

/* ---------------- sidebar ---------------- */
function num(id) { const v = parseFloat($(id).value); return isNaN(v) ? 0 : v; }
function syncSidebar() {
  for (const s of document.querySelectorAll("#kindSeg .seg")) s.classList.toggle("on", s.dataset.kind === G.kind);
  $("kindHint").textContent = KIND_HINT[G.kind];
  const b = box();
  $("boxState").textContent = stateKey() || "—";
  for (const [id, key] of [["fx", "x"], ["fy", "y"], ["fw", "w"], ["fh", "h"]]) { $(id).value = b ? +b[key].toFixed(1) : ""; $(id).disabled = !b; }
  $("delBtn").disabled = !b; $("defBtn").disabled = !b; $("applyAllBtn").disabled = !b;
  $("attackWin").classList.toggle("show", G.kind === "attack");
  if (b && G.kind === "attack") { $("t0").value = b.t0 ?? 0; $("t1").value = b.t1 ?? 0.2; $("t0v").textContent = (b.t0 ?? 0).toFixed(2); $("t1v").textContent = (b.t1 ?? 0.2).toFixed(2); }
  const fr = frameObj(G.char, stateKey()), a = align(G.char, stateKey()) || {};
  if (fr) { $("adx").value = a.dx != null ? a.dx : (fr.dx || 0); $("afoot").value = a.foot != null ? a.foot : (fr.foot || 0); $("aw").value = a.w != null ? a.w : fr.w; $("ah").value = a.h != null ? a.h : fr.h; }
}
for (const [id, key] of [["fx", "x"], ["fy", "y"], ["fw", "w"], ["fh", "h"]]) $(id).addEventListener("input", () => { const b = box(); if (b) b[key] = num(id); });
$("t0").addEventListener("input", () => { const b = box(); if (b) { b.t0 = +$("t0").value; $("t0v").textContent = b.t0.toFixed(2); } });
$("t1").addEventListener("input", () => { const b = box(); if (b) { b.t1 = +$("t1").value; $("t1v").textContent = b.t1.toFixed(2); } });
function setAlignFields() { const c = G.char, s = stateKey(); if (!G.data.spriteAlign[c]) G.data.spriteAlign[c] = {}; G.data.spriteAlign[c][s] = { dx: num("adx"), foot: num("afoot"), w: Math.max(8, num("aw")), h: Math.max(8, num("ah")) }; }
for (const id of ["adx", "afoot", "aw", "ah"]) $(id).addEventListener("input", () => { setAlignFields(); buildStripThumb(G.frameIdx); });
function buildStripThumb(idx) { const t = $("strip").children[idx]; if (t) drawThumb(t.querySelector("canvas"), G.anim.frames[idx]); }

for (const s of document.querySelectorAll("#kindSeg .seg")) s.addEventListener("click", () => { G.kind = s.dataset.kind; syncSidebar(); });
$("delBtn").addEventListener("click", () => { setBox(null); refreshStrip(); syncSidebar(); });
$("resetFrameBtn").addEventListener("click", () => { const k = stateKey(); if (G.data.hitboxes[G.char]) delete G.data.hitboxes[G.char][k]; refreshStrip(); syncSidebar(); });
$("applyAllBtn").addEventListener("click", () => {
  const b = box(); if (!b || !G.anim) return;
  for (const key of G.anim.frames) recFor(G.char, key, true)[G.kind] = { ...b };
  refreshStrip(); flash("Applied " + G.kind + " to " + G.anim.frames.length + " frames", "ok");
});
$("defBtn").addEventListener("click", () => {
  const b = box(); if (!b) return; const c = G.char;
  if (!G.data.hitboxes[c]) G.data.hitboxes[c] = {}; if (!G.data.hitboxes[c].default) G.data.hitboxes[c].default = {};
  G.data.hitboxes[c].default[G.kind] = { x: b.x, y: b.y, w: b.w, h: b.h };
  flash("Set " + c + " default " + G.kind, "ok");
});
$("charSel").addEventListener("change", e => { G.char = e.target.value; buildAnimList(); syncStats(); });
$("animSel").addEventListener("change", e => selectAnim(+e.target.value));

/* ---------------- tabs ---------------- */
function setTab(name) {
  document.body.className = "mode-" + name;
  for (const t of document.querySelectorAll(".tab")) t.classList.toggle("on", t.dataset.tab === name);
  if (name === "test") { stopMapView(); syncStats(); positionGameFrame(); startPracticeNow(); }   // straight into the clean arena — no menu
  else if (name === "map") { startMapNow(); }
  else { stopMapView(); try { G.win && G.win.eval && G.win.eval("if(typeof running!=='undefined')running=false;"); } catch (e) {} }  // pause the match when leaving
}
for (const t of document.querySelectorAll(".tab")) t.addEventListener("click", () => setTab(t.dataset.tab));
function positionGameFrame() {
  const host = document.getElementById("gameHost"); if (!host) return;
  const r = host.getBoundingClientRect(), g = document.getElementById("game");
  g.style.left = r.left + "px"; g.style.top = r.top + "px"; g.style.width = Math.max(1, r.width) + "px"; g.style.height = Math.max(1, r.height) + "px";
}
window.addEventListener("resize", () => {
  if (document.body.classList.contains("mode-test")) positionGameFrame();
  if (document.body.classList.contains("mode-map") && G.map.started) { positionMapFrame(); drawOverlay(); }
});

/* ---------------- stats & test ---------------- */
const STAT_FIELDS = [["stHp", "hp"], ["stArmor", "armor"], ["stSpeed", "speed"], ["stJump", "jump"], ["stPower", "power"], ["stSkill", "skillDmg"]];
function syncStats() {
  const c = G.char, s = G.data.charStats[c] || {}, d = G.charDefaults[c] || {};
  $("statsChar").textContent = c || "—"; $("testCharName").textContent = c || "—";
  $("stHp").value = s.hp != null ? s.hp : (d.hp != null ? d.hp : "");
  $("stArmor").value = s.armor != null ? s.armor : (d.armor != null ? d.armor : "");
  $("stSpeed").value = s.speed != null ? s.speed : (d.speed != null ? d.speed : "");
  $("stJump").value = s.jump != null ? s.jump : (d.jump != null ? d.jump : "");
  $("stPower").value = s.power != null ? s.power : (d.power != null ? d.power : "");
  $("stSkill").value = s.skillDmg != null ? s.skillDmg : 1;
  $("stHpDef").textContent = d.hp ?? ""; $("stArmorDef").textContent = d.armor ?? ""; $("stSpeedDef").textContent = d.speed ?? ""; $("stJumpDef").textContent = d.jump ?? ""; $("stPowerDef").textContent = d.power ?? "";
}
function setStat(key, raw) {
  const c = G.char; if (!G.data.charStats[c]) G.data.charStats[c] = {};
  const v = parseFloat(raw);
  if (raw === "" || isNaN(v)) delete G.data.charStats[c][key]; else G.data.charStats[c][key] = v;
  if (!Object.keys(G.data.charStats[c]).length) delete G.data.charStats[c];
}
for (const [id, key] of STAT_FIELDS) $(id).addEventListener("input", () => setStat(key, $(id).value));
$("statsReset").addEventListener("click", () => { delete G.data.charStats[G.char]; syncStats(); });
function applyStatsToGame() {
  try { G.win.eval("(function(all){ if(typeof CHAR_STATS!=='undefined'){ Object.assign(CHAR_STATS, all); if(typeof applyCharStats==='function')applyCharStats(); } })(" + JSON.stringify(G.data.charStats) + ")"); } catch (e) { console.warn("applyStats", e); }
}
function gameHasLauncher() { try { return !!G.win.eval("typeof TOOL_startPractice==='function'"); } catch (e) { return false; } }
/* Reload the iframe to pick up fresh game code, then run cb once it's ready. */
function reloadGameThen(cb) {
  flash("Loading test arena…");
  const f = document.getElementById("game");
  const onload = () => {
    f.removeEventListener("load", onload);
    const t = setInterval(() => {
      try { if (f.contentWindow.eval("typeof IMG_SPRITES!=='undefined' && typeof TOOL_startPractice==='function'")) { clearInterval(t); boot(); setTimeout(cb, 250); } } catch (e) {}
    }, 150);
    setTimeout(() => clearInterval(t), 8000);
  };
  f.addEventListener("load", onload);
  try { f.contentWindow.location.reload(); } catch (e) {}
}
function startPracticeNow() {
  if (!G.win) return;
  if (!gameHasLauncher()) { reloadGameThen(startPracticeNow); return; }   // stale game code -> refresh it, then retry
  applyStatsToGame();
  let ok = false; try { ok = G.win.eval("TOOL_startPractice('" + G.char + "')"); } catch (e) { flash("Start failed: " + e.message, "err"); return; }
  if (!ok) { flash("Could not start practice", "err"); return; }
  positionGameFrame(); flash("Practice — click the game and play", "ok");
  setTimeout(() => { try { document.getElementById("game").contentWindow.focus(); } catch (e) {} }, 120);
}
/* Put the game into the frozen clean arena at load so the title menu is never shown. */
function primeArena() {
  if (!gameHasLauncher()) return;
  try { G.win.eval("TOOL_startPractice('" + G.char + "'); (typeof running!=='undefined')&&(running=false);"); } catch (e) {}
}
$("testStart").addEventListener("click", startPracticeNow);
$("testStop").addEventListener("click", () => { try { G.win.eval("if(typeof running!=='undefined')running=false;"); } catch (e) {} });   // freeze (stay on the clean arena, no menu)
$("charScale").addEventListener("input", () => setCharSize(+$("charScale").value));
$("charScaleNum").addEventListener("input", () => setCharSize(+$("charScaleNum").value));
$("csReset").addEventListener("click", () => setCharSize(1));

/* ============================================================================================
   MAP EDITOR
   Truthful stage editor. The map preview is a SEPARATE game instance (#mapGame, loaded ?map=1) that
   renders at the REAL game viewport/ground, so the background aligns with decor exactly as in-game.

   ONE projection model (MapProj) is the single source of world<->editor conversion. It mirrors the
   game's own camera: world (wx,wy) -> viewport px -> overlay backing px, and the exact inverse. Zoom
   and pan are an editor-only view transform expressed as the game's map camera {camX, camTop, scale};
   they never touch object/world coordinates. Everything (markers, walls, dragging, hit-testing,
   diagnostics) goes through MapProj so the two directions are guaranteed inverses.
   ============================================================================================ */
function mEval(expr) { try { return G.map.win && G.map.win.eval(expr); } catch (e) { return undefined; } }
function mapReady() { try { return !!(G.map.win && G.map.win.eval("typeof TOOL_startMapView==='function' && typeof IMG_SPRITES!=='undefined' && Object.keys(IMG_SPRITES).length>0")); } catch (e) { return false; } }

/* ---- ONE projection model: world <-> overlay-backing px (exact inverses) ---- */
const MapProj = {
  wW() { return G.map.world.W || 720; }, wH() { return G.map.world.H || 270; },
  // overlay backing px per game-canvas logical px (canvas W maps onto the overlay's full backing width)
  bx() { const ov = $("mapOverlay"); return ov.width / this.wW(); },
  by() { const ov = $("mapOverlay"); return ov.height / this.wH(); },
  worldToScreen(wx, wy) { const c = G.map.cam; return { x: (wx - c.camX) * c.scale * this.bx(), y: (wy - c.camTop) * c.scale * this.by() }; },
  screenToWorld(sx, sy) { const c = G.map.cam; return { x: c.camX + (sx / this.bx()) / c.scale, y: c.camTop + (sy / this.by()) / c.scale }; }
};
/* backing-px coords of a mouse event over the overlay */
function evScreen(e) { const ov = $("mapOverlay"), r = ov.getBoundingClientRect(); return { x: (e.clientX - r.left) * (ov.width / r.width), y: (e.clientY - r.top) * (ov.height / r.height) }; }

/* ---- object override bookkeeping (editor-local; pushed live into #mapGame's MAP_DATA) ---- */
function objOf(id) { return G.map.objects[id] || { dx: 0, dy: 0, scale: 1 }; }
function isDefault(o) { return (o.dx || 0) === 0 && (o.dy || 0) === 0 && (o.scale == null || o.scale === 1); }
/* world position of an object's anchor with its current move applied (authoritative, zoom-independent) */
function objWorld(id) { const a = G.map.anchors[id], o = objOf(id); return { x: (a ? a.x : 0) + (o.dx || 0), y: (a ? a.y : 0) + (o.dy || 0) }; }
function setObj(id, patch) {
  const o = Object.assign({ dx: 0, dy: 0, scale: 1 }, G.map.objects[id] || {}, patch);
  o.dx = Math.round(o.dx); o.dy = Math.round(o.dy);
  if (isDefault(o)) delete G.map.objects[id]; else G.map.objects[id] = o;
  pushObjLive(id);
}
/* set an object by its ABSOLUTE world anchor position (used by drag + numeric X/Y) */
function setObjWorld(id, wx, wy) { const a = G.map.anchors[id]; if (!a) return; setObj(id, { dx: wx - a.x, dy: wy - a.y }); }
function pushObjLive(id) {
  const o = objOf(id);
  mEval("(function(id,dx,dy,sc){ if(typeof MAP_DATA==='undefined')return; if(dx===0&&dy===0&&sc===1){delete MAP_DATA.objects[id];} else {MAP_DATA.objects[id]={dx:dx,dy:dy,scale:sc};} })('" + id + "'," + (o.dx || 0) + "," + (o.dy || 0) + "," + (o.scale || 1) + ")");
}
function limitL() { return G.map.limits.wallL != null ? G.map.limits.wallL : G.map.base.wallL; }
function limitR() { return G.map.limits.wallR != null ? G.map.limits.wallR : G.map.base.wallR; }

/* ---- camera (editor-only zoom/pan) ---- */
function clampScale(s) { return Math.max(G.map.fitScale * 0.85, Math.min(G.map.fitScale * 16, s)); }
function applyCam() { const c = G.map.cam; mEval("typeof TOOL_mapCam==='function' && TOOL_mapCam(" + c.camX + "," + c.camTop + "," + c.scale + ")"); updateZoomLabel(); drawOverlay(); updateDiag(); }
function updateZoomLabel() { const el = $("mapZoomPct"); if (el) el.textContent = Math.round((G.map.cam.scale / G.map.fitScale) * 100) + "%"; }
function fitStage() {
  const W = MapProj.wW(), H = MapProj.wH(), WW = G.map.world.WORLD_W || 2032;
  const sc = W / WW;                                   // whole world width across the canvas
  G.map.fitScale = sc;
  G.map.cam = { camX: 0, camTop: H / 2 - H / (2 * sc), scale: sc };   // content [0..H] centred vertically
  applyCam();
}
/* zoom keeping the world point under (sx,sy) [backing px] fixed on screen */
function zoomAt(newScale, sx, sy) {
  const before = MapProj.screenToWorld(sx, sy);
  G.map.cam.scale = clampScale(newScale);
  const c = G.map.cam;
  c.camX = before.x - (sx / MapProj.bx()) / c.scale;
  c.camTop = before.y - (sy / MapProj.by()) / c.scale;
  applyCam();
}

/* ---- overlay draw ---- */
function drawOverlay() {
  const ov = $("mapOverlay"); if (!ov || !G.map.started) return;
  const g = ov.getContext("2d"), dpr = G.map.dpr || 1;
  g.clearRect(0, 0, ov.width, ov.height);
  // ==== boundary overlays: RED = real fighter walls (playable area), YELLOW = stage/world extent ====
  const scr = wx => MapProj.worldToScreen(wx, 0).x;
  const fw = G.map.fighterWalls || {}, hasFW = fw.left != null && fw.right != null;
  // shade the NON-PLAYABLE zones — outside the real fighter walls (fall back to stage limits if unknown)
  const playL = scr(hasFW ? fw.left : limitL()), playR = scr(hasFW ? fw.right : limitR());
  g.fillStyle = "rgba(6,4,14,0.52)";
  if (playL > 0) g.fillRect(0, 0, Math.min(playL, ov.width), ov.height);
  if (playR < ov.width) { const x0 = Math.max(0, playR); g.fillRect(x0, 0, ov.width - x0, ov.height); }
  // vertical labelled line helper (side "L"/"R" places the chip inside the playable side)
  const vline = (x, o) => {
    if (x < -80 || x > ov.width + 80) return;
    g.save(); g.strokeStyle = o.color; g.lineWidth = o.lw * dpr;
    if (o.glow) { g.shadowColor = o.color; g.shadowBlur = o.glow * dpr; }
    if (o.dash) g.setLineDash([9 * dpr, 6 * dpr]);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, ov.height); g.stroke(); g.restore();
    g.font = "700 " + (11 * dpr) + "px 'Segoe UI',sans-serif"; g.textAlign = "left"; g.textBaseline = "top";
    const chipW = g.measureText(o.label).width + 12 * dpr;
    const bx = o.side === "L" ? Math.max(2 * dpr, x + 5 * dpr) : Math.min(ov.width - chipW - 2 * dpr, x - 5 * dpr - chipW);
    g.fillStyle = o.chip; g.fillRect(bx, o.top * dpr, chipW, 18 * dpr);
    g.fillStyle = o.ink; g.fillText(o.label, bx + 6 * dpr, (o.top + 3) * dpr);
  };
  // YELLOW = stage/world extent (WALL_L/WALL_R — editable outer bounds), thin dashed reference
  for (const key of ["wallL", "wallR"]) {
    const wx = key === "wallL" ? limitL() : limitR();
    const hot = (G.map.drag && G.map.drag.type === "wall" && G.map.drag.key === key) || G.map.hoverWall === key;
    vline(scr(wx), { color: hot ? "#ffe25a" : "#caa62f", lw: hot ? 3 : 1.6, glow: hot ? 10 : 0, dash: true,
      side: key === "wallL" ? "L" : "R", top: 28, label: "stage edge  x=" + Math.round(wx),
      chip: hot ? "rgba(255,226,90,0.97)" : "rgba(202,166,47,0.85)", ink: "#170f04" });
  }
  // RED = the actual FIGHTER movement walls (the true playable boundary)
  if (hasFW) {
    vline(scr(fw.left), { color: "#ff3b3b", lw: 3, glow: 9, side: "L", top: 5,
      label: "◀ FIGHTER LEFT WALL  x=" + Math.round(fw.left), chip: "rgba(255,59,59,0.96)", ink: "#fff" });
    vline(scr(fw.right), { color: "#ff3b3b", lw: 3, glow: 9, side: "R", top: 5,
      label: "FIGHTER RIGHT WALL ▶  x=" + Math.round(fw.right), chip: "rgba(255,59,59,0.96)", ink: "#fff" });
  }
  g.textBaseline = "alphabetic";
  // object markers
  for (const id in G.map.anchors) {
    const a = G.map.anchors[id], w = objWorld(id), p = MapProj.worldToScreen(w.x, w.y), sel = id === G.map.sel;
    const r = (sel ? 8 : 6) * dpr;
    if (sel) { g.beginPath(); g.arc(p.x, p.y, 15 * dpr, 0, 7); g.strokeStyle = "#8f6cf0"; g.lineWidth = 2 * dpr; g.stroke(); }
    g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fillStyle = sel ? "#8f6cf0" : "#60a5fa"; g.fill();
    g.lineWidth = 2 * dpr; g.strokeStyle = "#fff"; g.stroke();
    const label = a.label || id, ty = p.y - 13 * dpr;
    g.font = "600 " + (11 * dpr) + "px 'Segoe UI',sans-serif"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    const tw = g.measureText(label).width;
    g.fillStyle = sel ? "rgba(143,108,240,.92)" : "rgba(10,8,22,.62)";
    g.fillRect(p.x - tw / 2 - 5 * dpr, ty - 12 * dpr, tw + 10 * dpr, 15 * dpr);
    g.fillStyle = "#fff"; g.fillText(label, p.x, ty);
  }
}

/* ---- object list (chips in the bottom toolbar) ---- */
function buildObjList() {
  const box = $("mapObjList"); if (!box) return; box.innerHTML = "";
  for (const id in G.map.anchors) {
    const a = G.map.anchors[id], moved = !isDefault(objOf(id));
    const el = document.createElement("div"); el.className = "objitem" + (id === G.map.sel ? " on" : "");
    el.innerHTML = '<span class="dot"></span>' + (a.label || id) + (moved ? '<span class="moved">•edited</span>' : "");
    el.addEventListener("click", () => selectObj(id));
    box.appendChild(el);
  }
}
function selectObj(id) { G.map.sel = id; buildObjList(); syncSel(); drawOverlay(); }
/* refresh the "Selected object" fields (authoritative WORLD x/y + size) */
function syncSel() {
  const id = G.map.sel, has = id && G.map.anchors[id];
  $("mapSelName").textContent = has ? (G.map.anchors[id].label || id) : "none";
  const w = has ? objWorld(id) : { x: 0, y: 0 }, o = has ? objOf(id) : { scale: 1 };
  for (const el of ["mapWX", "mapWY", "mapScaleNum", "mapObjReset"]) $(el).disabled = !has;
  if (document.activeElement !== $("mapWX")) $("mapWX").value = Math.round(w.x);
  if (document.activeElement !== $("mapWY")) $("mapWY").value = Math.round(w.y);
  if (document.activeElement !== $("mapScaleNum")) $("mapScaleNum").value = +(o.scale || 1).toFixed(2);
  $("mapWallL").value = Math.round(limitL()); $("mapWallR").value = Math.round(limitR());
}

/* ---- diagnostics overlay (toggle with D) ---- */
function updateDiag(mouse) {
  const el = $("mapDiag"); if (!el) return; el.classList.toggle("on", G.map.diag);
  if (!G.map.diag) return;
  const c = G.map.cam, dpr = G.map.dpr || 1;
  // read the LIVE gameplay values straight from the running stage (single source of truth)
  const gw = mEval("({l:WALL_L,r:WALL_R,ww:WORLD_W,bw:(typeof STAGE_BG!=='undefined'&&STAGE_BG.naturalWidth)||0})") || {};
  const eL = limitL(), eR = limitR();
  const pL = MapProj.worldToScreen(eL, 0).x / dpr, pR = MapProj.worldToScreen(eR, 0).x / dpr;   // editor CSS px
  const match = (gw.l === eL && gw.r === eR) ? "OK — editor == game" : "MISMATCH!";
  let s =
    "VIEW   zoom " + Math.round(c.scale / G.map.fitScale * 100) + "%   scale " + c.scale.toFixed(4) +
    "\n       pan camX " + Math.round(c.camX) + "  camTop " + Math.round(c.camTop) +
    "\nSTAGE  worldX origin 0 .. width " + (gw.ww != null ? gw.ww : G.map.world.WORLD_W) +
    "\n       background " + (gw.bw || "?") + "px  ->  " + (gw.ww != null ? gw.ww : "?") + " world (no offset)" +
    "\nSTAGE LIMITS (yellow) " + match +
    "\n  gameplay WALL_L " + gw.l + "   WALL_R " + gw.r +
    "\n  editor   L " + eL + "   R " + eR + "   px L " + Math.round(pL) + " R " + Math.round(pR);
  const fw = G.map.fighterWalls;
  if (fw && fw.left != null) s += "\nFIGHTER WALLS (red) — the real playable bounds" +
    "\n  left  CARS_WALL_X " + fw.left +
    "\n  right TOILET_WALL " + fw.right + (fw.rightOpen != null ? "  (open " + fw.rightOpen + ")" : "");
  if (mouse) { const w = MapProj.screenToWorld(mouse.x, mouse.y); s += "\nMOUSE  world " + Math.round(w.x) + "," + Math.round(w.y); }
  if (G.map.sel) { const w = objWorld(G.map.sel); s += "\nSEL " + G.map.sel + "  world " + Math.round(w.x) + "," + Math.round(w.y); }
  el.textContent = s;
}

/* ---- hit testing ---- */
function mapHit(sc) {
  const dpr = G.map.dpr || 1;
  for (const key of ["wallL", "wallR"]) { const wx = key === "wallL" ? limitL() : limitR(), p = MapProj.worldToScreen(wx, 0); if (Math.abs(sc.x - p.x) < 8 * dpr) return { type: "wall", key }; }
  let best = null, bd = 18 * dpr;
  for (const id in G.map.anchors) { const w = objWorld(id), p = MapProj.worldToScreen(w.x, w.y), d = Math.hypot(sc.x - p.x, sc.y - p.y); if (d < bd) { bd = d; best = id; } }
  return best ? { type: "obj", id: best } : null;
}

/* ---- overlay interaction: select/drag objects, drag walls, pan, wheel-zoom ---- */
(function wireOverlay() {
  const ov = $("mapOverlay");
  ov.addEventListener("mousedown", e => {
    if (!G.map.started) return;
    const sc = evScreen(e);
    // pan: middle button, or space held, or empty-space left drag
    const wantPan = e.button === 1 || G.map.spaceDown;
    const hit = wantPan ? null : mapHit(sc);
    if (wantPan || (!hit && e.button === 0)) {
      e.preventDefault();
      G.map.pan = { sx: sc.x, sy: sc.y, camX: G.map.cam.camX, camTop: G.map.cam.camTop };
      ov.style.cursor = "grabbing"; return;
    }
    if (!hit) return;
    e.preventDefault();
    if (hit.type === "obj") {
      selectObj(hit.id);
      const w = objWorld(hit.id), mw = MapProj.screenToWorld(sc.x, sc.y);
      G.map.drag = { type: "obj", id: hit.id, offx: w.x - mw.x, offy: w.y - mw.y };
    } else G.map.drag = { type: "wall", key: hit.key };
  });
  window.addEventListener("mousemove", e => {
    if (!G.map.started) return;
    const sc = evScreen(e);
    if (G.map.pan) {
      const c = G.map.cam, p = G.map.pan;
      c.camX = p.camX - (sc.x - p.sx) / MapProj.bx() / c.scale;
      c.camTop = p.camTop - (sc.y - p.sy) / MapProj.by() / c.scale;
      applyCam(); return;
    }
    if (G.map.drag) {
      const mw = MapProj.screenToWorld(sc.x, sc.y), d = G.map.drag;
      if (d.type === "obj") { setObjWorld(d.id, Math.round(mw.x + d.offx), Math.round(mw.y + d.offy)); syncSel(); }
      else { let x = Math.round(mw.x); if (d.key === "wallL") x = Math.max(0, Math.min(x, limitR() - 60)); else x = Math.max(limitL() + 60, x); G.map.limits[d.key] = x; syncSel(); }
      drawOverlay();
    } else {
      // idle hover: highlight a wall when near it, give cursor feedback
      const hit = mapHit(sc), hw = (hit && hit.type === "wall") ? hit.key : null;
      if (hw !== G.map.hoverWall) { G.map.hoverWall = hw; drawOverlay(); }
      ov.style.cursor = hw ? "ew-resize" : (hit ? "pointer" : (G.map.spaceDown ? "grab" : ""));
      if (G.map.diag) updateDiag(sc);
    }
  });
  window.addEventListener("mouseup", () => {
    if (G.map.pan) { G.map.pan = null; $("mapOverlay").style.cursor = ""; }
    if (G.map.drag) { G.map.drag = null; buildObjList(); }
  });
  ov.addEventListener("wheel", e => {
    if (!G.map.started) return;
    e.preventDefault();
    const sc = evScreen(e), factor = Math.pow(1.0015, -e.deltaY);   // smooth, cursor-anchored
    zoomAt(G.map.cam.scale * factor, sc.x, sc.y);
  }, { passive: false });
})();

/* ---- toolbar controls ---- */
$("mapWX").addEventListener("input", () => { if (!G.map.sel) return; const w = objWorld(G.map.sel); setObjWorld(G.map.sel, parseFloat($("mapWX").value) || w.x, w.y); drawOverlay(); buildObjList(); });
$("mapWY").addEventListener("input", () => { if (!G.map.sel) return; const w = objWorld(G.map.sel); setObjWorld(G.map.sel, w.x, parseFloat($("mapWY").value) || w.y); drawOverlay(); buildObjList(); });
$("mapScaleNum").addEventListener("input", () => { if (!G.map.sel) return; setObj(G.map.sel, { scale: parseFloat($("mapScaleNum").value) || 1 }); drawOverlay(); buildObjList(); });
$("mapObjReset").addEventListener("click", () => { if (!G.map.sel) return; delete G.map.objects[G.map.sel]; pushObjLive(G.map.sel); syncSel(); drawOverlay(); buildObjList(); });
$("mapWallL").addEventListener("input", () => { const v = parseInt($("mapWallL").value, 10); if (!isNaN(v)) { G.map.limits.wallL = v; drawOverlay(); } });
$("mapWallR").addEventListener("input", () => { const v = parseInt($("mapWallR").value, 10); if (!isNaN(v)) { G.map.limits.wallR = v; drawOverlay(); } });
$("mapLimitsReset").addEventListener("click", () => { G.map.limits = {}; syncSel(); drawOverlay(); });
$("mapZoomIn").addEventListener("click", () => zoomAt(G.map.cam.scale * 1.25, $("mapOverlay").width / 2, $("mapOverlay").height / 2));
$("mapZoomOut").addEventListener("click", () => zoomAt(G.map.cam.scale / 1.25, $("mapOverlay").width / 2, $("mapOverlay").height / 2));
$("mapFit").addEventListener("click", fitStage);
$("mapResetView").addEventListener("click", fitStage);
/* Space = pan modifier; D = diagnostics (only while on the Map tab) */
window.addEventListener("keydown", e => {
  if (!document.body.classList.contains("mode-map")) return;
  if (e.code === "Space") { G.map.spaceDown = true; $("mapOverlay").style.cursor = "grab"; e.preventDefault(); }
  else if (e.key === "d" || e.key === "D") { G.map.diag = !G.map.diag; updateDiag(); }
});
window.addEventListener("keyup", e => { if (e.code === "Space") { G.map.spaceDown = false; $("mapOverlay").style.cursor = ""; } });

/* ---- lifecycle ---- */
function positionMapFrame() {
  const host = $("mapHost"); if (!host) return;
  const r = host.getBoundingClientRect(), W = MapProj.wW(), H = MapProj.wH();
  const sc = Math.min(r.width / W, r.height / H), w = Math.max(1, W * sc), h = Math.max(1, H * sc);
  const left = r.left + (r.width - w) / 2, top = r.top + (r.height - h) / 2;
  const f = $("mapGame"), ov = $("mapOverlay"), dpr = window.devicePixelRatio || 1;
  for (const el of [f, ov]) { el.style.left = left + "px"; el.style.top = top + "px"; el.style.width = w + "px"; el.style.height = h + "px"; }
  ov.width = Math.max(1, Math.round(w * dpr)); ov.height = Math.max(1, Math.round(h * dpr)); G.map.dpr = dpr;
}
function startMapNow() {
  const f = $("mapGame"); G.map.win = f.contentWindow;
  if (!mapReady()) { flash("Loading map preview…"); const t = setInterval(() => { G.map.win = f.contentWindow; if (mapReady()) { clearInterval(t); startMapNow(); } }, 150); setTimeout(() => clearInterval(t), 12000); return; }
  // authoritative world data straight from the real game instance
  G.map.anchors = mEval("typeof MAP_ANCHORS!=='undefined'?MAP_ANCHORS:{}") || G.map.anchors;
  const wd = mEval("({W:W,H:H,WORLD_W:WORLD_W,WALL_L:WALL_L,WALL_R:WALL_R})");
  if (wd) { G.map.world = { W: wd.W, H: wd.H, WORLD_W: wd.WORLD_W }; }
  const b = mEval("typeof MAP_LIMIT_BASE!=='undefined'?MAP_LIMIT_BASE:null"); if (b) G.map.base = b;
  // REAL fighter movement walls (the actual playable boundary), read live from the running stage:
  //   left  = CARS_WALL_X (stages/kabatepe/cars.js) — engine clamps f.x >= CARS_WALL_X
  //   right = TOILET_WALL (stages/kabatepe/toilet.js) — solid shack face; shifts to TOILET_WALL_OPEN when the door opens
  const fw = mEval("({left:(typeof CARS_WALL_X!=='undefined'?CARS_WALL_X:null),right:(typeof TOILET_WALL!=='undefined'?TOILET_WALL:null),rightOpen:(typeof TOILET_WALL_OPEN!=='undefined'?TOILET_WALL_OPEN:null)})");
  if (fw) G.map.fighterWalls = { left: fw.left, right: fw.right != null ? fw.right : fw.rightOpen, rightOpen: fw.rightOpen };
  mEval("typeof TOOL_MAP!=='undefined' && TOOL_MAP===true") || mEval("TOOL_startMapView()");   // ensure map mode
  for (const id in G.map.objects) pushObjLive(id);   // re-apply in-progress overrides onto the fresh stage
  G.map.started = true;
  positionMapFrame(); fitStage(); buildObjList(); syncSel();
  flash("Map — scroll to zoom · Space/middle-drag to pan · drag a marker to move", "ok");
}
function stopMapView() { G.map.started = false; }

/* ---------------- save / export / reload ---------------- */
function flash(msg, cls) { const s = $("status"); s.textContent = msg; s.className = "status " + (cls || ""); }
$("saveBtn").addEventListener("click", async () => {
  flash("Saving…");
  try {
    buildTScale();   // flatten macro × per-animation fps into the per-state time-scale the engine reads
    const res = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(G.data) });
    const j = await res.json();
    if (!j.ok) { flash("Save failed: " + j.error, "err"); return; }
    // persist map overrides (object moves/sizes + world limits) to stages/kabatepe/map-data.js
    const mr = await fetch("/api/save-map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objects: G.map.objects, limits: G.map.limits }) });
    const mj = await mr.json();
    flash(mj.ok ? ("Saved → " + j.file + " + " + mj.file) : ("Boxes saved; map failed: " + mj.error), mj.ok ? "ok" : "err");
  } catch (e) { flash("Save failed: " + e.message, "err"); }
});
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(G.data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "hitbox-data.json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$("reloadBtn").addEventListener("click", async () => {
  $("loading").style.display = "flex"; flash("Rescanning sprite folders…");
  try { const r = await fetch("/api/rescan", { method: "POST" }); const j = await r.json(); if (j.ok) flash("Rescanned " + j.total + " sprites" + (j.added ? (" · +" + j.added + " new") : ""), "ok"); }
  catch (e) { flash("Rescan failed: " + e.message, "err"); }
  G.win = null; $("game").contentWindow.location.reload(); boot();
});

window.addEventListener("keydown", e => {
  if (document.body.classList.contains("mode-test")) return;   // don't hijack keys while playtesting
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (e.code === "Space") { e.preventDefault(); setPlaying(!G.playing); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); stepFrame(-1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); stepFrame(1); }
  else if (e.key === "1") { G.kind = "hurt"; syncSidebar(); }
  else if (e.key === "2") { G.kind = "coll"; syncSidebar(); }
  else if (e.key === "3") { G.kind = "attack"; syncSidebar(); }
  else if (e.key === "Delete" || e.key === "Backspace") { setBox(null); refreshStrip(); syncSidebar(); }
  else if (e.key.toLowerCase() === "s" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $("saveBtn").click(); }
});

boot();
