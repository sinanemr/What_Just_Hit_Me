/**
 * What Just Hit Me — right-side PUBLIC TOILET event for the Kabatepe stage.
 * Plain <script>, loaded AFTER engine.js (uses fighters, GROUND, WALL_L/R, S, ctx,
 * statusFloat, spawnHitFx, ringFx, roundOver, projectiles).
 *
 * - A toilet shack sits on the right and acts as a SOLID WALL (can't pass it).
 * - Hit it 3 times and the door opens; the "nöbetçi" (caretaker) appears:
 *     idle1 (in doorway) -> idle2 (steps out) -> idle1 (stands) -> swear -> RUN
 *   he then charges left across the stage and disappears off the left edge, shoving
 *   fighters in his way. Then the toilet resets so it can be triggered again.
 *
 * Sizes/timings are first-pass — tune once the sprites are in.
 */
"use strict";

const TOILET_X = 1655;           // toilet centre (world x, right side) — TUNE
const TOILET_SIZE = 130;         // draw size of the shack (world px) — TUNE
const TOILET_FOOT = 18;           // base sits this far below GROUND — TUNE for alignment
const TOILET_WALL = TOILET_X - 50;   // fighters cannot pass to the RIGHT of this x (the shack's left face)
const TOILET_HITS = 3;           // hits to pop the door
const TOILET_HIT_CD = 0.35;      // per-fighter throttle so one swing = one hit

const NB_SIZE = 65;              // caretaker draw size (world px) — TUNE
const NB_FOOT = 1;               // caretaker feet alignment — TUNE
const NB_SPEED = 150;            // run speed (world px/s)
const NB_STEP = 22;              // how far left he steps while coming out
const NB_DMG = 50;                // shove damage on contact while running (set 0 for harmless)
const NB_KB = 220;               // shove knockback
const NB_BODY = 28;              // shove reach
const NB_CHANCE = 0.30;          // chance the nöbetçi is inside when the door opens (else empty — stench still appears)
const TOILET_WALL_OPEN = TOILET_X - 70;   // the wall shifts further LEFT once the door swings open
const SMELL_RANGE = 15;                    // fighters within this of the open door get poisoned by the stench
const SMELL_POISON_DPS = 6, SMELL_POISON_SEC = 2;
// per-sprite base facing (set to 1 if the art faces RIGHT, -1 if it faces LEFT).
// If the man faces the wrong way in-game, flip these.
const NB_BASE_FACE = { idle1: 1, idle2: 1, swear: 1, run1: 1, run2: 1 };
// per-frame draw-size multiplier — the run frames draw the man a bit smaller inside the
// sprite, so scale them up to keep his on-screen size consistent. TUNE the run values.
const NB_FRAME_SCALE = { idle1: 1, idle2: 1, swear: 1, run1: 1.1, run2: 1.1 };

const T_DIR = "assets/stages/kabatepe/toilet/";
const T_IMG = {};
["toilet_closed", "toilet_open", "idle1", "idle2", "swear", "run1", "run2"].forEach(k => { const im = new Image(); im.src = T_DIR + k + ".png"; T_IMG[k] = im; });

let toilet = { hits: 0, open: false, shakeT: 0 };
let nobetci = null;              // caretaker entity, or null

function resetToilet() {
  toilet = { hits: 0, open: false, shakeT: 0 };
  nobetci = null;
}

function hitToilet(attacker) {
  if (toilet.open || nobetci) return;              // already triggered
  toilet.hits++; toilet.shakeT = 0.18;
  if (typeof spawnHitFx === "function") spawnHitFx(TOILET_WALL, GROUND - S(40), "#8a6a42", 6);
  if (toilet.hits >= TOILET_HITS) {
    toilet.open = true;
    // the door swings out — the wall jumps further left; shove anyone caught in the new zone
    if (typeof fighters !== "undefined") for (const f of fighters) {
      if (f.alive && f.x > TOILET_WALL_OPEN) { f.x = TOILET_WALL_OPEN; f.vx = -170; }
    }
    if (Math.random() < NB_CHANCE) {   // ~30%: the caretaker is inside and comes out to chase
      nobetci = { x: TOILET_X - 14, facing: -1, state: "idle1", t: 0, hitByRun: [] };
    }
    if (typeof ringFx === "function") ringFx(TOILET_X, GROUND - S(30), "#e8e0d0", 60);
  }
}

/* Authoritative per-frame update (host + local; the guest gets it from snapshots). */
function updateToilet(dt) {
  if (toilet.shakeT > 0) toilet.shakeT -= dt;

  // SOLID WALL — nobody passes to the right of the shack (wall moves further left once open)
  const wall = toilet.open ? TOILET_WALL_OPEN : TOILET_WALL;
  if (typeof fighters !== "undefined") {
    for (const f of fighters) {
      if (!f.alive) continue;
      if (f.x > wall) { f.x = wall; if (f.vx > 0) f.vx = 0; }
      // the open door reeks — fighters lingering near it keep getting poisoned
      if (toilet.open && f.x > TOILET_WALL_OPEN - SMELL_RANGE) {
        f.poisonDps = SMELL_POISON_DPS; f.poison = Math.max(f.poison || 0, SMELL_POISON_SEC);
        if ((f._smellT || 0) <= 0) { statusFloat(f, "POISON", "#9dff5e"); f._smellT = 1.4; }
      }
      if (f._smellT > 0) f._smellT -= dt;
    }
  }

  if (typeof roundOver !== "undefined" && roundOver) return;

  // hit detection (only until triggered): a fighter attacking into the shack's face
  if (!toilet.open && !nobetci && typeof fighters !== "undefined") {
    for (const f of fighters) {
      // ONE basic attack / ONE skill = ONE hit (multi-hit moves count once) via the attack-instance id
      if (f.alive && (f.state === "attack" || f.state === "special") && f._toiletHitSeq !== (f.atkSeq || 0)
          && f.facing > 0 && (TOILET_WALL - f.x) < S(46) + 30 && (TOILET_WALL - f.x) > -20) {
        hitToilet(f); f._toiletHitSeq = (f.atkSeq || 0);
      }
    }
    // damaging projectiles that reach the shack also count as hits
    if (typeof projectiles !== "undefined") {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if ((p.dmg || p.power || 0) > 0 && Math.abs(p.x - TOILET_WALL) < S(26) && p.y > GROUND - S(70)) {
          hitToilet(p.owner || null); projectiles.splice(i, 1); break;
        }
      }
    }
  }

  if (!nobetci) return;
  nobetci.t += dt;
  switch (nobetci.state) {
    case "idle1": if (nobetci.t >= 0.6) { nobetci.state = "idle2"; nobetci.t = 0; } break;
    case "idle2":                                   // steps out of the doorway
      nobetci.x -= (NB_STEP / 0.8) * dt;
      if (nobetci.t >= 0.8) { nobetci.state = "idle1b"; nobetci.t = 0; } break;
    case "idle1b": if (nobetci.t >= 0.5) { nobetci.state = "swear"; nobetci.t = 0; } break;
    case "swear": if (nobetci.t >= 2.4) { nobetci.state = "run"; nobetci.t = 0; } break;
    case "run":
      nobetci.x -= NB_SPEED * dt;
      // shove fighters he barges through
      if (typeof fighters !== "undefined") for (const f of fighters) {
        if (!f.alive || f.y < GROUND - S(8)) continue;   // up on an obstacle/airborne: the running caretaker can't reach them
        if (Math.abs(f.x - nobetci.x) < NB_BODY && nobetci.hitByRun.indexOf(f) < 0) {
          nobetci.hitByRun.push(f);
          if (NB_DMG > 0) f.takeDamage(NB_DMG, NB_KB, -1, { melee: true, unblockable: true, col: "#d8cfc4", fx: "#d8cfc4" });
          else { f.vx = -NB_KB; f.x -= 6; }
        }
      }
      if (nobetci.x < WALL_L - 90) { nobetci = null; }  // gone; door STAYS open (stench remains) for the round
      break;
  }
}

/* Speech bubble in the game's own pixel style (chunky off-white box with corner tabs,
   thin outline, pixel tail, Press Start 2P text — same build as the "Hmm" bubble) but
   RED. It POPS in (age = seconds shown) and fades with `fade` (0..1). Tail points down
   toward (cx, tailY). Supports multi-line. */
function nbBubble(cx, tailY, lines, age, fade) {
  age = age || 0; fade = (fade == null) ? 1 : fade;
  const pop = Math.min(1, age / 0.13);
  const sc = 0.5 + 0.5 * (1 - (1 - pop) * (1 - pop));                 // ease-out pop-in
  const alpha = Math.max(0, Math.min(1, fade * Math.min(1, age / 0.1)));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "5px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lh = 8, padX = 5, padY = 4, ink = "#c0392b", edge = "#2a1012";
  let w = 0;
  for (const ln of lines) w = Math.max(w, ctx.measureText(ln).width);
  const bw = Math.round(w + padX * 2), bh = Math.round(lines.length * lh + padY * 2 - 3);
  ctx.translate(Math.round(cx), Math.round(tailY - 9 - bh / 2));
  ctx.translate(Math.sin(tGlobal * 34) * 0.5, Math.sin(tGlobal * 3.4) * 1.7);   // lively shake + bob (animated, never static)
  const throb = 1 + Math.sin(tGlobal * 16) * 0.06;                              // shouting throb
  ctx.scale(sc * throb, sc * throb);                                            // pop-in + throb
  // body (chunky pixel "rounded" corner tabs)
  ctx.fillStyle = "rgba(248,250,255,.96)";
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillRect(-bw / 2 - 2, -bh / 2 + 3, 2, bh - 6);
  ctx.fillRect(bw / 2, -bh / 2 + 3, 2, bh - 6);
  ctx.fillRect(-bw / 2 + 3, -bh / 2 - 2, bw - 6, 2);
  ctx.fillRect(-bw / 2 + 3, bh / 2, bw - 6, 2);
  // pixel tail pointing down at his head
  ctx.fillRect(-2, bh / 2, 4, 3); ctx.fillRect(-4, bh / 2 + 3, 3, 3);
  // outline
  ctx.fillStyle = edge;
  ctx.fillRect(-bw / 2, -bh / 2 - 2, bw, 1); ctx.fillRect(-bw / 2, bh / 2 + 1, bw, 1);
  ctx.fillRect(-bw / 2 - 2, -bh / 2, 1, bh); ctx.fillRect(bw / 2 + 1, -bh / 2, 1, bh);
  // text
  ctx.fillStyle = ink;
  const y0 = -bh / 2 + padY + lh / 2 - 1;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 0, y0 + i * lh);
  ctx.restore();
}

/* World-space draw (called from renderGame). */
function drawToilet() {
  // ---- the shack ----
  const timg = toilet.open ? T_IMG.toilet_open : T_IMG.toilet_closed;
  const shx = toilet.shakeT > 0 ? (Math.random() * 4 - 2) : 0;
  ctx.save();
  ctx.translate(Math.round(TOILET_X + shx), 0);
  if (timg && timg.complete && timg.naturalWidth > 0) {
    ctx.drawImage(timg, -TOILET_SIZE / 2, GROUND + TOILET_FOOT - TOILET_SIZE, TOILET_SIZE, TOILET_SIZE);
  } else {
    ctx.fillStyle = "#8a6a42"; ctx.fillRect(-40, GROUND - 110, 80, 110);
    ctx.fillStyle = "#5c452c"; ctx.fillRect(-18, GROUND - 80, 36, 78);
  }
  ctx.restore();

  // ---- lingering stench from the open door (looping green wafts; rendered on host + guest) ----
  if (toilet.open) {
    const dx = TOILET_X - TOILET_SIZE * 0.14;
    for (let i = 0; i < 5; i++) {
      const ph = (tGlobal * 0.7 + i * 0.6) % 1;                 // 0..1 loop
      const py = GROUND - S(16) - ph * 46;
      const px = dx + Math.sin(tGlobal * 2 + i * 2) * 6;
      ctx.globalAlpha = 0.30 * (1 - ph);
      ctx.fillStyle = i % 2 ? "#8fae5a" : "#a9a15e";
      ctx.beginPath(); ctx.arc(px, py, 3 + ph * 5, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // hit pips (before the door opens)
  if (!toilet.open && !nobetci && toilet.hits > 0) {
    for (let i = 0; i < TOILET_HITS; i++) {
      ctx.fillStyle = i < toilet.hits ? "#e2384a" : "#4a3f34";
      ctx.fillRect(Math.round(TOILET_X - 18 + i * 14), GROUND - Math.round(TOILET_SIZE * 0.98), 9, 5);
    }
  }

  // ---- the caretaker ----
  if (nobetci) {
    let frame;
    if (nobetci.state === "idle2") frame = "idle2";
    else if (nobetci.state === "swear") frame = "swear";
    else if (nobetci.state === "run") frame = (Math.floor(nobetci.t * 4.5) % 2) ? "run2" : "run1";   /* run cadence: lower = slower */
    else frame = "idle1";
    const img = T_IMG[frame];
    const base = NB_BASE_FACE[frame] || 1;
    const flip = nobetci.facing !== base;
    ctx.save();
    ctx.translate(Math.round(nobetci.x), 0);
    if (flip) ctx.scale(-1, 1);
    const sz = NB_SIZE * (NB_FRAME_SCALE[frame] || 1);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -sz / 2, GROUND + NB_FOOT - sz, sz, sz);
    } else {
      ctx.fillStyle = nobetci.state === "swear" ? "#c0392b" : "#c9a27a"; ctx.fillRect(-12, GROUND - 60, 24, 60);
    }
    ctx.restore();
    // shouting speech bubbles (unflipped, animated; each state has its own height)
    if (nobetci.state === "swear")                                      // standing tall -> bubble higher
      nbBubble(nobetci.x, GROUND + NB_FOOT - sz * 1.02, ["AMK, OROSPU", "COCUKLARI"], nobetci.t);
    else if (nobetci.state === "run" && nobetci.t < 2.1)               // leaning/running -> bubble lower; fades out
      nbBubble(nobetci.x, GROUND + NB_FOOT - sz * 0.72, ["GEL LAN", "BURAYA PIC"], nobetci.t, nobetci.t > 1.7 ? (2.1 - nobetci.t) / 0.4 : 1);
  }
}

/* Online sync (host -> guest). */
function toiletSerialize() {
  return {
    hits: toilet.hits, open: toilet.open,
    nb: nobetci ? { x: nobetci.x, facing: nobetci.facing, state: nobetci.state, t: nobetci.t } : null
  };
}
function toiletApply(s) {
  if (!s) return;
  toilet.hits = s.hits; toilet.open = s.open;
  nobetci = s.nb ? { x: s.nb.x, facing: s.nb.facing, state: s.nb.state, t: s.nb.t, hitByRun: [] } : null;
}
