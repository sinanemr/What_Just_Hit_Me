/**
 * What Just Hit Me — backgammon TABLE (Blackgammon table_01) props on the Kabatepe stage.
 * Plain <script>, loaded AFTER engine.js (uses ctx). Pure static decoration, drawn with the ground
 * decor behind the fighters (and in FRONT of the chair, as if someone sits at it).
 * To add another table, just append an entry to Bgammon_PLACES.
 */
"use strict";

const Bgammon_DIR = "assets/stages/kabatepe/Static/";
const Bgammon_IMG = new Image();
Bgammon_IMG.src = Bgammon_DIR + "Blackgammon table_01.png";

const Bgammon_IMG_W = 1080;
const Bgammon_CX = 540, Bgammon_BOTTOM = 1053, Bgammon_CW = 616;   // measured: centre x, leg-base y, table width
const Bgammon_SCALE = 0.65;   // resize all tables together (tuning)

// x/y = ground-contact point (world), w = width in world px (sized to depth), rot tilt, flip mirror.
const Bgammon_PLACES = [
  { x: 340, y: 205, w: 38 }   // by the Seat_02 / soda umbrella cluster near the security cabinet
];

/* World-space draw (called from renderGame, with the ground decor, behind the fighters). */
function drawBlackgammonTables() {
  if (!(Bgammon_IMG.complete && Bgammon_IMG.naturalWidth > 0)) return;
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  for (const p of Bgammon_PLACES) {
    const scale = (p.w * Bgammon_SCALE) / Bgammon_CW;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (p.rot) ctx.rotate(p.rot);
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(Bgammon_IMG, -Bgammon_CX * scale, -Bgammon_BOTTOM * scale, Bgammon_IMG_W * scale, Bgammon_IMG_W * scale);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = sm;
}
