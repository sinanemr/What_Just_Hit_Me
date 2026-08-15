/**
 * What Just Hit Me — TRASHBIN props on the Kabatepe stage. Plain <script>, loaded AFTER engine.js
 * (uses ctx). Pure static decoration, drawn with the ground decor behind the fighters.
 *
 * Two sprite variants: "01" (green domed bin) and "02" (green barrel bin). To add another bin, just
 * append an entry to Trash_PLACES — set k:"01" or k:"02" for the sprite (defaults to "01").
 */
"use strict";

const Trash_DIR = "assets/stages/kabatepe/Static/";
const Trash_IMGS = {};
["01", "02"].forEach(k => { const im = new Image(); im.src = Trash_DIR + "Trashbin_" + k + ".png"; Trash_IMGS[k] = im; });

const Trash_IMG_W = 1080;
// per-variant measured content anchors: cx = centre x, bottom = ground-contact y, cw = content width.
const Trash_META = {
  "01": { cx: 550, bottom: 978, cw: 348 },
  "02": { cx: 540, bottom: 1005, cw: 364 }
};
const Trash_SCALE = 0.65;   // resize all bins together (tuning)

// k = sprite variant. x/y = ground-contact point (world), w = width in world px (sized to depth),
// rot tilt, flip mirror.
const Trash_PLACES = [
  { k: "01", x: 306, y: 200, w: 18 },    // left of the security cabinet
  { k: "02", x: 1590, y: 220, w: 34 }    // next to the toilet
];

/* World-space draw (called from renderGame, with the ground decor, behind the fighters). */
function drawTrashbins() {
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  for (const p of Trash_PLACES) {
    const k = p.k || "01", img = Trash_IMGS[k], m = Trash_META[k];
    if (!m || !(img && img.complete && img.naturalWidth > 0)) continue;
    const scale = (p.w * Trash_SCALE) / m.cw;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (p.rot) ctx.rotate(p.rot);
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -m.cx * scale, -m.bottom * scale, Trash_IMG_W * scale, Trash_IMG_W * scale);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = sm;
}
