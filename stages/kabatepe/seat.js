/**
 * What Just Hit Me — white plastic CHAIR (Seat_02) props on the Kabatepe stage.
 * Plain <script>, loaded AFTER engine.js (uses ctx). Pure static decoration, drawn with the ground
 * decor behind the fighters. To add another chair, just append an entry to Seat_PLACES.
 */
"use strict";

const Seat_DIR = "assets/stages/kabatepe/Static/";
const Seat_IMG = new Image();
Seat_IMG.src = Seat_DIR + "Seat_02.png";

const Seat_IMG_W = 1080;
const Seat_CX = 543, Seat_BOTTOM = 980, Seat_CW = 559;   // measured content: centre x, ground-contact bottom, width
const Seat_SCALE = 0.75;   // resize all chairs together (tuning)

// x/y = ground-contact point (world), w = width in world px (sized to depth), rot tilt, flip mirror.
const Seat_PLACES = [
  { x: 335, y: 203, w: 26, flip: true, rot: 0.02 }   // right of the security cabinet, facing out
];

/* World-space draw (called from renderGame, with the ground decor, behind the fighters). */
function drawSeats() {
  if (!(Seat_IMG.complete && Seat_IMG.naturalWidth > 0)) return;
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  for (const p of Seat_PLACES) {
    const scale = (p.w * Seat_SCALE) / Seat_CW;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (p.rot) ctx.rotate(p.rot);
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(Seat_IMG, -Seat_CX * scale, -Seat_BOTTOM * scale, Seat_IMG_W * scale, Seat_IMG_W * scale);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = sm;
}
