/**
 * What Just Hit Me — yellow diving FINS left on the ground in front of / under the wetsuit rack
 * (WetsuitsDry_01) on the Kabatepe pier. Plain <script>, loaded AFTER engine.js (uses ctx). Pure
 * static decoration; drawn right after the wetsuits so the fins sit IN FRONT of them.
 *
 * The rack (stages/kabatepe/WetsuitsDry.js) sits at world (920, 222) and spans world x ~882..958. The fins are
 * scaled well down to match that view and scattered along its base like gear dropped after a dive.
 */
"use strict";

const YFin_DIR = "assets/stages/kabatepe/Static/";
const YFin_IMG = new Image();
YFin_IMG.src = YFin_DIR + "YellowFin_01.png";

const YFin_IMG_W = 1080;                       // source canvas
const YFin_CW = 675;                           // measured content width (image px)
const YFin_ANCHOR = { cx: 535, bottom: 785 };  // content centre x + ground-contact y (image px)

// ---- GROUP TUNING — resize / nudge all fins together ----
const YFin_SCALE = 0.7;      // 1 = current size; smaller/larger to rescale all fins
const YFin_SHIFT_X = 0;    // move all fins right(+)/left(-)
const YFin_SHIFT_Y = -5;    // move all fins down(+, nearer)/up(-, further)

// Four fins along the base of the rack. x/y = ground-contact point (world), w = fin length (world
// px, kept small to match the view), rot = radians tilt, flip = point left. In front of the rack
// -> slightly larger world_y than the rack base (222).
const YFin_PLACES = [
  { x: 900, y: 224, w: 21, rot: 0.05 },              // points right, back-left
  { x: 918, y: 225, w: 22, rot: -0.04, flip: true }, // points left
  { x: 934, y: 226, w: 22, rot: 0.06 },              // points right
  { x: 950, y: 227, w: 23, rot: -0.05, flip: true }  // points left, front-right
];

/* Draw one fin so its ground-contact point (anchor) sits at (x,y), with optional tilt/mirror. */
function drawOneFin(p) {
  if (!(YFin_IMG.complete && YFin_IMG.naturalWidth > 0)) return;
  const scale = (p.w * YFin_SCALE) / YFin_CW;
  ctx.save();
  ctx.translate(Math.round(p.x + YFin_SHIFT_X), Math.round(p.y + YFin_SHIFT_Y));
  if (p.rot) ctx.rotate(p.rot);
  if (p.flip) ctx.scale(-1, 1);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(YFin_IMG, -YFin_ANCHOR.cx * scale, -YFin_ANCHOR.bottom * scale, YFin_IMG_W * scale, YFin_IMG_W * scale);
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();
}

/* World-space draw (called from renderGame, right after the wetsuits, behind the fighters). */
function drawYellowFins() {
  for (const p of YFin_PLACES) drawOneFin(p);
}
