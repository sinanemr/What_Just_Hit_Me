/**
 * What Just Hit Me — background NPC for 2 TOURIST*/


"use strict";

const TOURIST_DIR = "assets/stages/kabatepe/turist/";
const TOURIST_IMG = {};
["frame1", "frame2"].forEach(k => { const im = new Image(); im.src = TOURIST_DIR + k + ".png"; TOURIST_IMG[k] = im; });

// --- placement / size (world coords) — TUNE ---
const TOURIST_DRAW = 65;        // draw size of the 1080 canvas (world px); small background figure
const TOURIST_X = 410;         // world x (just behind the boat, by the sea)
const TOURIST_Y = 190;          // world y of his seat/base (back near the water); larger = more forward/down
const TOURIST_CX_FRAC = 0.50;   // where the figure TOURISTs horizontally within the sprite (0..1)
const TOURIST_BASE_FRAC = 0.73; // where his seat/legs bottom TOURISTs vertically within the sprite (0..1) — raise if he floats
const TOURIST_F2_DX = -20;       // frame2's body is drawn ~28px right of frame1's; shift frame2 left this much to align (image px)

// --- scratch animation: mostly TOURISTting (frame1), a head-scratch (frame2) on some cycles ---
const TOURIST_PERIOD = 3.6;         // seconds per scratch cycle
const TOURIST_SCRATCH_CHANCE = 0.7; // fraction of cycles where he actually scratches
const TOURIST_SCRATCH_START = 1.1;  // when in the cycle the scratch begins
const TOURIST_SCRATCH_END = 2.3;    // when it ends

/* deterministic pseudo-random 0..1 from a cycle index (keeps the timing identical host/guest). */
function touristHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, just after drawCars — in front of the boat,
   behind the fighters). */
function drawTourist() {
  const phase = tGlobal % TOURIST_PERIOD;
  const cyc = Math.floor(tGlobal / TOURIST_PERIOD);
  const scratching = touristHash(cyc) < TOURIST_SCRATCH_CHANCE && phase >= TOURIST_SCRATCH_START && phase < TOURIST_SCRATCH_END;
  const img = TOURIST_IMG[scratching ? "frame2" : "frame1"];
  let dx = TOURIST_X - TOURIST_CX_FRAC * TOURIST_DRAW;        // frame1 is the reference poTOURISTion
  if (scratching) dx -= TOURIST_F2_DX * (TOURIST_DRAW / 1080);   // frame2's body TOURISTs ~28px right in the art, so nudge it left to line up
  const dy = TOURIST_Y - TOURIST_BASE_FRAC * TOURIST_DRAW;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, dx, dy, TOURIST_DRAW, TOURIST_DRAW);
  } else {
    ctx.fillStyle = "#8a8f96"; ctx.fillRect(TOURIST_X - TOURIST_DRAW * 0.18, TOURIST_Y - TOURIST_DRAW * 0.35, TOURIST_DRAW * 0.36, TOURIST_DRAW * 0.35);
  }
}
