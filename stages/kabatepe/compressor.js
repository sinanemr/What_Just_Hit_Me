/**
 * What Just Hit Me — background NPC for the Kabatepe stage: a guy fiddling with a diving
 * compressor in front of the white boat. Plain <script>, loaded AFTER engine.js (uses
 * GROUND, ctx, tGlobal). Pure decoration — drawn in front of the boat but BEHIND the
 * fighters, animation driven by the synced tGlobal, so host and guest match with no sync.
 *
 * Two frames alternate (he reaches the top handle, then dips to the valve). Both frames are
 * drawn at ONE uniform scale and pinned by the COMPRESSOR's measured base, so the compressor
 * never jumps size/position between frames — only the man animates. While he is on the 2nd
 * frame, SOME cycles (chosen by a deterministic per-cycle hash) leak a little gas.
 */
"use strict";

const COMP_DIR = "assets/stages/kabatepe/compressor/";
const COMP_IMG = {};
["frame1", "frame2"].forEach(k => { const im = new Image(); im.src = COMP_DIR + k + ".png"; COMP_IMG[k] = im; });

// --- placement / size (world coords) — TUNE ---
const COMP_DRAW = 68;      // draw size of the 1080 canvas (world px); controls overall size (smaller than fighters)
const COMP_X = 1045;        // world x of the COMPRESSOR base (in front of / just left of the boat)
const COMP_Y = 213;        // world y of the compressor base (feet line); larger = more forward/down
const COMP_IMG_W = 1080;   // source PNG size (both frames are 1080x1080)
// Measured stationary anchor of the compressor base in each frame (image px) so it stays put.
const COMP_ANCHOR = { frame1: { cx: 858, bottom: 1047 }, frame2: { cx: 855, bottom: 1056 } };

// --- animation: mostly frame1, dips to frame2 (the valve reach) each cycle ---
const COMP_PERIOD = 1.7;   // full cycle length (s)
const COMP_F2_START = 1.05;// point in the cycle where he switches to frame2

// --- gas leak: only during frame2, only on some cycles, kept small ---
const COMP_LEAK_CHANCE = 0.45;   // fraction of frame2 cycles that leak
const COMP_LEAK_DX = -9;   // valve x offset from the compressor base (world px) — TUNE to the valve
const COMP_LEAK_DY = 16;   // valve height above the base (world px) — TUNE

/* deterministic pseudo-random 0..1 from a cycle index (keeps the leak identical host/guest). */
function compLeakHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, just after drawCars — in front of the boat,
   behind the fighters). */
function drawCompressorGuy() {
  const phase = tGlobal % COMP_PERIOD;
  const inF2 = phase >= COMP_F2_START;
  const key = inF2 ? "frame2" : "frame1";
  const img = COMP_IMG[key];
  const a = COMP_ANCHOR[key];
  const scale = COMP_DRAW / COMP_IMG_W;               // one scale for both frames -> compressor never resizes
  const dx = COMP_X - a.cx * scale;                    // pin the compressor base to (COMP_X, COMP_Y)
  const dy = COMP_Y - a.bottom * scale;

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, dx, dy, COMP_DRAW, COMP_DRAW);
  } else {
    ctx.fillStyle = "#6a7350"; ctx.fillRect(COMP_X - COMP_DRAW * 0.2, COMP_Y - COMP_DRAW * 0.3, COMP_DRAW * 0.4, COMP_DRAW * 0.3);
  }

  // small gas leak from the valve, only during frame2 and only on "leaking" cycles
  if (inF2) {
    const cyc = Math.floor(tGlobal / COMP_PERIOD);
    if (compLeakHash(cyc) < COMP_LEAK_CHANCE) {
      const age = (phase - COMP_F2_START) / (COMP_PERIOD - COMP_F2_START);   // 0..1 across frame2
      drawGasLeak(COMP_X + COMP_LEAK_DX, COMP_Y - COMP_LEAK_DY, tGlobal, age);
    }
  }
}

/* A small hissing gas jet drifting out to the right from (lx, ly). Kept subtle. */
function drawGasLeak(lx, ly, t, age) {
  const intensity = Math.sin(Math.max(0, Math.min(1, age)) * Math.PI);   // fades in and back out
  if (intensity <= 0.02) return;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const ph = (t * 1.6 + i * 0.21) % 1;                                  // each puff drifts out then fades
    const px = lx + ph * COMP_DRAW * 0.18 + Math.sin(t * 6 + i) * 1.2;
    const py = ly - ph * COMP_DRAW * 0.06 + Math.sin(t * 4 + i * 2) * 1.6;
    ctx.globalAlpha = 0.26 * intensity * (1 - ph);
    ctx.fillStyle = i % 2 ? "#e2e8ec" : "#c4ced4";
    ctx.beginPath(); ctx.arc(px, py, COMP_DRAW * 0.02 + ph * COMP_DRAW * 0.05, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
