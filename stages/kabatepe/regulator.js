/**
 * What Just Hit Me — foreground NPC for the Kabatepe stage: a diver kneeling by the scuba
 * tanks, checking his regulator gauge. Plain <script>, loaded AFTER engine.js (uses ctx,
 * tGlobal). Pure decoration — animation driven by the synced tGlobal so host and guest match.
 *
 * Two frames: he studies the gauge (frame1), then glances up (frame2). Only the head/arm move,
 * so both frames draw at the SAME rect (measured content bottom/centre) — the body never jumps.
 */
"use strict";

const REG_DIR = "assets/stages/kabatepe/regulator/";
const REG_IMG = {};
["frame1", "frame2"].forEach(k => { const im = new Image(); im.src = REG_DIR + k + ".png"; REG_IMG[k] = im; });

// --- placement / size (world coords) — TUNE to sit next to the scuba tanks ---
const REG_DRAW = 80;      // draw size of the 642 canvas (world px); foreground figure
const REG_X = 845;         // world x (beside the scuba tanks, foreground)
const REG_Y = 270;         // world y of his base (knees on the pier); larger = lower/more forward
const REG_IMG_W = 642;     // source PNG size (642x642)
const REG_CX = 323;        // measured content centre x (image px)
const REG_BOTTOM = 641;    // measured content bottom / his base (image px)

// --- idle: studies the gauge (frame1), glances up (frame2), gentle loop ---
const REG_PERIOD = 2.6;    // seconds per cycle
const REG_UP_START = 1.6;  // when in the cycle he glances up (frame2)

/* World-space draw (called from renderGame — behind the fighters). */
function drawRegulatorGuy() {
  const phase = tGlobal % REG_PERIOD;
  const img = REG_IMG[phase >= REG_UP_START ? "frame2" : "frame1"];
  const scale = REG_DRAW / REG_IMG_W;
  const dx = REG_X - REG_CX * scale;       // both frames share this rect -> body never jumps
  const dy = REG_Y - REG_BOTTOM * scale;
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;        // smooth the downscale so he isn't jagged
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, dx, dy, REG_DRAW, REG_DRAW);
  } else {
    ctx.fillStyle = "#7d7f52"; ctx.fillRect(REG_X - REG_DRAW * 0.14, REG_Y - REG_DRAW * 0.5, REG_DRAW * 0.28, REG_DRAW * 0.5);
  }
  ctx.imageSmoothingEnabled = sm;
}
