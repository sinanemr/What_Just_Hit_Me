/**
 * What Just Hit Me — SODA patio UMBRELLA (SodaUmbrella_01) props on the Kabatepe stage.
 * Plain <script>, loaded AFTER engine.js (uses ctx). Pure static decoration, drawn with the ground
 * decor behind the fighters (and behind the chair, so the chair sits in front of the pole).
 * To add another umbrella, just append an entry to Umbrella_PLACES.
 */
"use strict";

const Umbrella_DIR = "assets/stages/kabatepe/Static/";
const Umbrella_IMG = new Image();
Umbrella_IMG.src = Umbrella_DIR + "SodaUmbrella_01.png";

const Umbrella_IMG_W = 1080;
const Umbrella_CX = 528, Umbrella_BOTTOM = 1037, Umbrella_CW = 930;   // measured: centre x, pole-base y, canopy width
const Umbrella_SCALE = 1;   // resize all umbrellas together (tuning)

// x/y = ground-contact point (pole base, world), w = canopy width in world px (sized to depth),
// rot tilt, flip mirror.
const Umbrella_PLACES = [
  { x: 350, y: 203, w: 58 }   // beside/over the Seat_02 by the security cabinet
];

/* World-space draw (called from renderGame, with the ground decor, behind the fighters). */
function drawSodaUmbrellas() {
  if (!(Umbrella_IMG.complete && Umbrella_IMG.naturalWidth > 0)) return;
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  for (const p of Umbrella_PLACES) {
    const scale = (p.w * Umbrella_SCALE) / Umbrella_CW;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (p.rot) ctx.rotate(p.rot);
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(Umbrella_IMG, -Umbrella_CX * scale, -Umbrella_BOTTOM * scale, Umbrella_IMG_W * scale, Umbrella_IMG_W * scale);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = sm;
}
