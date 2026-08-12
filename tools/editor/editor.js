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
  data: { hitboxes: {}, spriteAlign: {}, charScale: {} },
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
  G.win = w; G.IMG = IMG;
  const HB = gEval("typeof HITBOXES!=='undefined' ? HITBOXES : {}") || {};
  const SA = gEval("typeof SPRITE_ALIGN!=='undefined' ? SPRITE_ALIGN : {}") || {};
  const CS = gEval("typeof CHAR_SCALE!=='undefined' ? CHAR_SCALE : {}") || {};
  try { G.data.hitboxes = JSON.parse(JSON.stringify(HB)); } catch (e) { G.data.hitboxes = {}; }
  try { G.data.spriteAlign = JSON.parse(JSON.stringify(SA)); } catch (e) { G.data.spriteAlign = {}; }
  try { G.data.charScale = JSON.parse(JSON.stringify(CS)); } catch (e) { G.data.charScale = {}; }
  buildCharList();
  $("loading").style.display = "none";
  requestAnimationFrame(tick);
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
function buildAnimList() {
  G.anims = deriveAnimations(G.char);
  const sel = $("animSel"); sel.innerHTML = "";
  G.anims.forEach((a, i) => { const o = document.createElement("option"); o.value = i; o.textContent = a.name + "  (" + a.frames.length + ")"; sel.appendChild(o); });
  selectAnim(0);
}
function selectAnim(i) {
  G.anim = G.anims[i] || G.anims[0]; G.frameIdx = 0; G.fps = G.anim.fps || 10;
  $("fps").value = G.fps; $("animSel").value = String(i);
  buildStrip(); syncSidebar(); syncCharSize();
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
    const interval = 1000 / Math.max(1, G.fps * G.speed);
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
$("fps").addEventListener("input", () => { G.fps = Math.max(1, +$("fps").value || 10); if (G.anim) G.anim.fps = G.fps; });
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
$("charSel").addEventListener("change", e => { G.char = e.target.value; buildAnimList(); });
$("animSel").addEventListener("change", e => selectAnim(+e.target.value));
$("charScale").addEventListener("input", () => setCharSize(+$("charScale").value));
$("charScaleNum").addEventListener("input", () => setCharSize(+$("charScaleNum").value));
$("csReset").addEventListener("click", () => setCharSize(1));

/* ---------------- save / export / reload ---------------- */
function flash(msg, cls) { const s = $("status"); s.textContent = msg; s.className = "status " + (cls || ""); }
$("saveBtn").addEventListener("click", async () => {
  flash("Saving…");
  try {
    const res = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(G.data) });
    const j = await res.json(); flash(j.ok ? ("Saved → " + j.file) : ("Save failed: " + j.error), j.ok ? "ok" : "err");
  } catch (e) { flash("Save failed: " + e.message, "err"); }
});
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(G.data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "hitbox-data.json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$("reloadBtn").addEventListener("click", () => { $("loading").style.display = "flex"; G.win = null; $("game").contentWindow.location.reload(); boot(); });

window.addEventListener("keydown", e => {
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
