/**
 * What Just Hit Me — diving MASKS (ScubaGlasses_01) set down around the Kabatepe dive gear.
 * Plain <script>, loaded AFTER engine.js (uses ctx). Pure static decoration.
 *
 * Three masks: TWO next to the CO2 tank (stages/kabatepe/CO2Tank.js, world 900/275 — a FOREGROUND item drawn in
 * front of the fighters) and ONE by the boat (on the pier, behind the fighters). Each mask carries a
 * `fore` flag so it renders on the correct layer: drawScubaGlassesFront() after the CO2 tank,
 * drawScubaGlassesBehind() with the ground decor. Scaled well down to match the view.
 */
"use strict";

const Scuba_DIR = "assets/stages/kabatepe/Static/";
const Scuba_IMG = new Image();
Scuba_IMG.src = Scuba_DIR + "ScubaGlasses_01.png";

const Scuba_IMG_W = 1080;                       // source canvas
const Scuba_CW = 232;                           // measured content width (image px)
const Scuba_ANCHOR = { cx: 540, bottom: 641 };  // content centre x + ground-contact y (image px)

// ---- GROUP TUNING — resize / nudge all masks together ----
const Scuba_SCALE = 1;      // 1 = current size
const Scuba_SHIFT_X = 0;    // move all masks right(+)/left(-)
const Scuba_SHIFT_Y = 0;    // move all masks down(+, nearer)/up(-, further)

// x/y = ground-contact point (world), w = mask width (world px, small), rot tilt, flip mirror.
// fore:true = the CO2-tank pair (foreground layer); fore:false = the boat one (behind fighters).
const Scuba_PLACES = [
  { x: 873, y: 263, w: 18, rot: -0.5, fore: true },              // left of the CO2 tank
  { x: 941, y: 228, w: 18, rot: -1.8, flip: true, fore: true },   // right of the CO2 tank
  { x: 968, y: 203, w: 9, rot: 0.6, fore: false }               // on the pier next to the boat
];

function drawOneScuba(p) {
  if (!(Scuba_IMG.complete && Scuba_IMG.naturalWidth > 0)) return;
  const scale = (p.w * Scuba_SCALE) / Scuba_CW;
  ctx.save();
  ctx.translate(Math.round(p.x + Scuba_SHIFT_X), Math.round(p.y + Scuba_SHIFT_Y));
  if (p.rot) ctx.rotate(p.rot);
  if (p.flip) ctx.scale(-1, 1);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(Scuba_IMG, -Scuba_ANCHOR.cx * scale, -Scuba_ANCHOR.bottom * scale, Scuba_IMG_W * scale, Scuba_IMG_W * scale);
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();
}

/* By the boat — drawn with the ground decor, behind the fighters. */
function drawScubaGlassesBehind() {
  for (const p of Scuba_PLACES) if (!p.fore) drawOneScuba(p);
}
/* Next to the CO2 tank — drawn in the foreground, after the tank. */
function drawScubaGlassesFront() {
  for (const p of Scuba_PLACES) if (p.fore) drawOneScuba(p);
}
