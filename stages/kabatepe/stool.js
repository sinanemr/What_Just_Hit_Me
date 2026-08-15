/**
 * What Just Hit Me — wooden STOOL (Wooden Stool_01) props on the Kabatepe stage.
 * Plain <script>, loaded AFTER engine.js (uses ctx). Pure static decoration, drawn with the ground
 * decor behind the fighters, and AFTER the backgammon table so it sits in front of it.
 * To add another stool, just append an entry to Stool_PLACES.
 *
 * Scale note: this sprite is tall, so it's sized by real height — a stool (~0.45 m) reads a bit
 * SHORTER than the table (which renders ~18 px tall at this depth), not the same image scale.
 */
"use strict";

const Stool_DIR = "assets/stages/kabatepe/Static/";
const Stool_IMG = new Image();
Stool_IMG.src = Stool_DIR + "Wooden Stool_01.png";

const Stool_IMG_W = 1080;
const Stool_CX = 545, Stool_BOTTOM = 957, Stool_CW = 431;   // measured: centre x, leg-base y, seat width
const Stool_SCALE = 1;   // resize all stools together (tuning)

// x/y = ground-contact point (world), w = width in world px (kept small so it's shorter than the
// table), rot tilt, flip mirror.
const Stool_PLACES = [
  { x: 340, y: 208, w: 12 }   // in front of the backgammon table
];

/* World-space draw (called from renderGame, with the ground decor, behind the fighters). */
function drawStools() {
  if (!(Stool_IMG.complete && Stool_IMG.naturalWidth > 0)) return;
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  for (const p of Stool_PLACES) {
    const scale = (p.w * Stool_SCALE) / Stool_CW;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (p.rot) ctx.rotate(p.rot);
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(Stool_IMG, -Stool_CX * scale, -Stool_BOTTOM * scale, Stool_IMG_W * scale, Stool_IMG_W * scale);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = sm;
}
