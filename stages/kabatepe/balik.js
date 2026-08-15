/**
 * What Just Hit Me — background NPC for the Kabatepe stage: a guy who is balikci*/


"use strict";

const BAL_DIR = "assets/stages/kabatepe/balik/";
const BAL_IMG = {};
["frame1", "frame2"].forEach(k => { const im = new Image(); im.src = BAL_DIR + k + ".png"; BAL_IMG[k] = im; });

// --- placement / size (world coords) — TUNE ---
const BAL_DRAW = 35;        // draw size of the 1080 canvas (world px); small background figure
const BAL_X = 1070;         // world x (just behind the boat, by the sea)
const BAL_Y = 185;          // world y of his seat/base (back near the water); larger = more forward/down
const BAL_CX_FRAC = 0.50;   // where the figure BALs horizontally within the sprite (0..1)
const BAL_BASE_FRAC = 0.73; // where his seat/legs bottom BALs vertically within the sprite (0..1) — raise if he floats
const BAL_F2_DX = 28;       // frame2's body is drawn ~28px right of frame1's; shift frame2 left this much to align (image px)

// --- scratch animation: mostly BALting (frame1), a head-scratch (frame2) on some cycles ---
const BAL_PERIOD = 3.6;         // seconds per scratch cycle
const BAL_SCRATCH_CHANCE = 0.7; // fraction of cycles where he actually scratches
const BAL_SCRATCH_START = 1.1;  // when in the cycle the scratch begins
const BAL_SCRATCH_END = 2.3;    // when it ends

/* deterministic pseudo-random 0..1 from a cycle index (keeps the timing identical host/guest). */
function balHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, just after drawCars — in front of the boat,
   behind the fighters). */
function drawbalikGuy() {
  const phase = tGlobal % BAL_PERIOD;
  const cyc = Math.floor(tGlobal / BAL_PERIOD);
  const scratching = balHash(cyc) < BAL_SCRATCH_CHANCE && phase >= BAL_SCRATCH_START && phase < BAL_SCRATCH_END;
  const img = BAL_IMG[scratching ? "frame2" : "frame1"];
  let dx = BAL_X - BAL_CX_FRAC * BAL_DRAW;        // frame1 is the reference poBALion
  if (scratching) dx -= BAL_F2_DX * (BAL_DRAW / 1080);   // frame2's body BALs ~28px right in the art, so nudge it left to line up
  const dy = BAL_Y - BAL_BASE_FRAC * BAL_DRAW;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, dx, dy, BAL_DRAW, BAL_DRAW);
  } else {
    ctx.fillStyle = "#8a8f96"; ctx.fillRect(BAL_X - BAL_DRAW * 0.18, BAL_Y - BAL_DRAW * 0.35, BAL_DRAW * 0.36, BAL_DRAW * 0.35);
  }
}
