/**
 * What Just Hit Me — blue plastic CRADLES (fish crates) around the Kabatepe dive gear.
 * Plain <script>, loaded AFTER engine.js (uses ctx). Pure static decoration.
 *
 * ONE crate next to the regulator diver (stages/kabatepe/regulator.js, world 845/270 — FOREGROUND, drawn in
 * front of the fighters) and TWO stacked next to the compressor (stages/kabatepe/compressorMech.js, world
 * 1035/210 — BACKGROUND, behind the fighters, so smaller for depth). Each placement's `fore` flag
 * routes it to the right layer: drawCradleFore() with the foreground, drawCradleBehind() with the
 * background decor.
 */
"use strict";

const Cradle_DIR = "assets/stages/kabatepe/Static/";
const Cradle_IMG = new Image();
Cradle_IMG.src = Cradle_DIR + "plastic cradle_01.png";

const Cradle_IMG_W = 1080;
// measured content: centre x, ground-contact bottom, content width + height (for stacking).
const Cradle_CX = 540, Cradle_BOTTOM = 1016, Cradle_CW = 660, Cradle_CH = 245;

const Cradle_SCALE = 1;   // resize all crates together (tuning)

// x/y = ground-contact point (world), w = crate width (world px, scaled to its depth), rot tilt,
// flip mirror, yoff = raise (stacking), fore = foreground(true)/background(false).
const Cradle_PLACES = [
  { x: 800, y: 272, w: 30, rot: 0.02, fore: true },             // beside the regulator diver (foreground)
  { x: 1002, y: 210, w: 20, fore: false },                      // by the compressor — bottom crate
  { x: 1003, y: 210, w: 20, flip: true, yoff: 7, fore: false }  // by the compressor — crate stacked on top
];

function drawOneCradle(p) {
  if (!(Cradle_IMG.complete && Cradle_IMG.naturalWidth > 0)) return;
  const scale = (p.w * Cradle_SCALE) / Cradle_CW;
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y - (p.yoff || 0) * Cradle_SCALE));
  if (p.rot) ctx.rotate(p.rot);
  if (p.flip) ctx.scale(-1, 1);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(Cradle_IMG, -Cradle_CX * scale, -Cradle_BOTTOM * scale, Cradle_IMG_W * scale, Cradle_IMG_W * scale);
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();
}

/* Next to the regulator — foreground, in front of the fighters. */
function drawCradleFore() { for (const p of Cradle_PLACES) if (p.fore) drawOneCradle(p); }
/* Next to the compressor — background, behind the fighters. */
function drawCradleBehind() { for (const p of Cradle_PLACES) if (!p.fore) drawOneCradle(p); }
