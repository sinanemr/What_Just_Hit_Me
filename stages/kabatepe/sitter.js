/**
 * What Just Hit Me — background NPC for the Kabatepe stage: a guy sitting by the sea, just
 * past the white boat, who occasionally scratches his head. Plain <script>, loaded AFTER
 * engine.js (uses ctx, tGlobal). Pure decoration — drawn in front of the boat but BEHIND
 * the fighters; animation is driven by the synced tGlobal so host and guest match (no sync).
 *
 * Frame 2 is just frame 1 with the arm raised (the body doesn't move), so both frames are
 * drawn at the SAME rect — the body stays put and only the arm animates, no jump. He sits
 * mostly on frame 1 and raises a hand to scratch on some cycles (chosen by a per-cycle hash).
 */
"use strict";

const SIT_DIR = "assets/stages/kabatepe/sitter/";
const SIT_IMG = {};
["frame1", "frame2"].forEach(k => { const im = new Image(); im.src = SIT_DIR + k + ".png"; SIT_IMG[k] = im; });

// --- placement / size (world coords) — TUNE ---
const SIT_DRAW = 72;        // draw size of the 1080 canvas (world px); small background figure
const SIT_X = 710;         // world x (just past the boat, by the sea)
const SIT_Y = 215;          // world y of his seat/base (back near the water); larger = more forward/down
const SIT_CX_FRAC = 0.50;   // where the figure sits horizontally within the sprite (0..1)
const SIT_BASE_FRAC = 0.73; // where his seat/legs bottom sits vertically within the sprite (0..1) — raise if he floats
const SIT_F2_DX = 28;       // frame2's body is drawn ~28px right of frame1's; shift frame2 left this much to align (image px)

// --- scratch animation: mostly sitting (frame1), a head-scratch (frame2) on some cycles ---
const SIT_PERIOD = 3.6;         // seconds per scratch cycle
const SIT_SCRATCH_CHANCE = 0.7; // fraction of cycles where he actually scratches
const SIT_SCRATCH_START = 1.1;  // when in the cycle the scratch begins
const SIT_SCRATCH_END = 2.3;    // when it ends

/* deterministic pseudo-random 0..1 from a cycle index (keeps the timing identical host/guest). */
function sitHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, just after drawCars — in front of the boat,
   behind the fighters). */
function drawSittingGuy() {
  const phase = tGlobal % SIT_PERIOD;
  const cyc = Math.floor(tGlobal / SIT_PERIOD);
  const scratching = sitHash(cyc) < SIT_SCRATCH_CHANCE && phase >= SIT_SCRATCH_START && phase < SIT_SCRATCH_END;
  const img = SIT_IMG[scratching ? "frame2" : "frame1"];
  let dx = SIT_X - SIT_CX_FRAC * SIT_DRAW;        // frame1 is the reference position
  if (scratching) dx -= SIT_F2_DX * (SIT_DRAW / 1080);   // frame2's body sits ~28px right in the art, so nudge it left to line up
  const dy = SIT_Y - SIT_BASE_FRAC * SIT_DRAW;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, dx, dy, SIT_DRAW, SIT_DRAW);
  } else {
    ctx.fillStyle = "#8a8f96"; ctx.fillRect(SIT_X - SIT_DRAW * 0.18, SIT_Y - SIT_DRAW * 0.35, SIT_DRAW * 0.36, SIT_DRAW * 0.35);
  }
}
