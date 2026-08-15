/**
 * What Just Hit Me — background NPC for 2 kids*/


"use strict";

const KIDS_DIR = "assets/stages/kabatepe/kids/";
const KIDS_IMG = {};
["frame1", "frame2"].forEach(k => { const im = new Image(); im.src = KIDS_DIR + k + ".png"; KIDS_IMG[k] = im; });

// --- placement / size (world coords) — TUNE ---
const KIDS_DRAW = 35;        // draw size of the 1080 canvas (world px); small background figure
const KIDS_X = 1290;         // world x (just behind the boat, by the sea)
const KIDS_Y = 203;          // world y of his seat/base (back near the water); larger = more forward/down
const KIDS_CX_FRAC = 0.50;   // where the figure KIDSs horizontally within the sprite (0..1)
const KIDS_BASE_FRAC = 0.73; // where his seat/legs bottom KIDSs vertically within the sprite (0..1) — raise if he floats
const KIDS_F2_DX = 28;       // frame2's body is drawn ~28px right of frame1's; shift frame2 left this much to align (image px)

// --- scratch animation: mostly KIDSting (frame1), a head-scratch (frame2) on some cycles ---
const KIDS_PERIOD = 3.6;         // seconds per scratch cycle
const KIDS_SCRATCH_CHANCE = 0.7; // fraction of cycles where he actually scratches
const KIDS_SCRATCH_START = 1.1;  // when in the cycle the scratch begins
const KIDS_SCRATCH_END = 2.3;    // when it ends

/* deterministic pseudo-random 0..1 from a cycle index (keeps the timing identical host/guest). */
function kidsHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, just after drawCars — in front of the boat,
   behind the fighters). */
function drawKids() {
  const phase = tGlobal % KIDS_PERIOD;
  const cyc = Math.floor(tGlobal / KIDS_PERIOD);
  const scratching = kidsHash(cyc) < KIDS_SCRATCH_CHANCE && phase >= KIDS_SCRATCH_START && phase < KIDS_SCRATCH_END;
  const img = KIDS_IMG[scratching ? "frame2" : "frame1"];
  let dx = KIDS_X - KIDS_CX_FRAC * KIDS_DRAW;        // frame1 is the reference poKIDSion
  if (scratching) dx -= KIDS_F2_DX * (KIDS_DRAW / 1080);   // frame2's body KIDSs ~28px right in the art, so nudge it left to line up
  const dy = KIDS_Y - KIDS_BASE_FRAC * KIDS_DRAW;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, dx, dy, KIDS_DRAW, KIDS_DRAW);
  } else {
    ctx.fillStyle = "#8a8f96"; ctx.fillRect(KIDS_X - KIDS_DRAW * 0.18, KIDS_Y - KIDS_DRAW * 0.35, KIDS_DRAW * 0.36, KIDS_DRAW * 0.35);
  }
}
