/**
 * What Just Hit Me — a shark FIN cruising the distant sea on the Kabatepe stage. Plain
 * <script>, loaded AFTER engine.js (uses ctx, tGlobal). Pure decoration — drawn on the sea
 * behind the fighters. Its whole path is a deterministic function of tGlobal (no stored
 * state) so host and guest match with no sync: it surfaces, slowly swims across, then
 * submerges for a gap and resurfaces at a fresh spot/direction.
 *
 * Two frames animate the water splash around the fin.
 */
"use strict";

const SHARK_DIR = "assets/stages/kabatepe/shark/";
const SHARK_IMG = {};
["frame1", "frame2"].forEach(k => { const im = new Image(); im.src = SHARK_DIR + k + ".png"; SHARK_IMG[k] = im; });

// --- placement / size (world coords) — TUNE ---
const SHARK_SIZE = 33;        // draw size (world px)
const SHARK_SEA_LEFT = 650;   // x range of the open water it patrols (the water left of the ferry)
const SHARK_SEA_RIGHT = 760;
const SHARK_SEA_TOP = 180;    // y band of the water surface there (near the sitting guy's level)
const SHARK_SEA_RANGE = 12;   // vertical spread of that band
const SHARK_BASE_FACE = 1;    // fin art faces RIGHT (wake to the left); set -1 if it faces left

// --- timing: surfaces and slowly swims across, then submerges for the rest of the cycle ---
const SHARK_CYCLE = 30;       // seconds per surfacing cycle
const SHARK_TRAVEL = 22;      // seconds it stays up and swimming (slow = far away)
const SHARK_FLAP = 2.4;       // water-splash animation rate (frames/s)

/* deterministic pseudo-random 0..1 from a loop index (keeps every pass identical host/guest). */
function sharkHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, in the background — behind the fighters). */
function drawShark() {
  const loopN = Math.floor(tGlobal / SHARK_CYCLE);
  const inCycle = tGlobal - loopN * SHARK_CYCLE;
  if (inCycle > SHARK_TRAVEL) return;                 // submerged during the gap between passes
  const progress = inCycle / SHARK_TRAVEL;            // 0..1 across the sea
  const dir = sharkHash(loopN * 5 + 1) < 0.5 ? 1 : -1;
  const startX = dir > 0 ? SHARK_SEA_LEFT : SHARK_SEA_RIGHT;
  const endX = dir > 0 ? SHARK_SEA_RIGHT : SHARK_SEA_LEFT;
  const x = startX + (endX - startX) * progress;
  const y = SHARK_SEA_TOP + sharkHash(loopN * 7 + 3) * SHARK_SEA_RANGE + Math.sin(tGlobal * 1.5) * 2;
  const fade = Math.max(0, Math.min(1, Math.min(progress, 1 - progress) / 0.1));   // surface/submerge fade
  const key = (Math.floor(tGlobal * SHARK_FLAP) % 2) ? "frame2" : "frame1";
  const img = SHARK_IMG[key];
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(Math.round(x), Math.round(y));
  if (dir * SHARK_BASE_FACE < 0) ctx.scale(-1, 1);    // face the swim direction
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;                   // smooth the heavy downscale so it isn't jagged
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, -SHARK_SIZE / 2, -SHARK_SIZE / 2, SHARK_SIZE, SHARK_SIZE);
  } else {
    ctx.fillStyle = "#5a6470"; ctx.beginPath(); ctx.moveTo(0, -SHARK_SIZE * 0.28); ctx.lineTo(SHARK_SIZE * 0.2, SHARK_SIZE * 0.12); ctx.lineTo(-SHARK_SIZE * 0.2, SHARK_SIZE * 0.12); ctx.fill();
  }
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();
}
