/**
 * What Just Hit Me — wooden PALLETS left around the otopark (car park) on the Kabatepe stage.
 * Plain <script>, loaded AFTER engine.js (uses ctx). Pure static decoration, drawn behind the
 * fighters — like pallets somebody dumped and never picked up.
 *
 * Four source sprites (1080x1080), used for variety:
 *   01 = a pallet lying FLAT on the ground (3/4 view)   -> stacks / ground
 *   02 = a pallet PROPPED UP / leaning
 *   03 = a single loose PLANK
 *   04 = a weathered pallet FACE (good standing upright)
 * Each placement can be sized (perspective), tilted (rot), mirrored (flip) and raised (yoff, for
 * stacking one on another). x/y is the GROUND-CONTACT point in world coords.
 *
 * Background map is 4000px wide -> WORLD_W(2032): world_x = bg_px * 0.508. The OTOPARK is the
 * painted parking grid on the RIGHT, between the red building and the little guard hut/toilet:
 * world x ~1345..1620 (the toilet wall is at ~1605), receding from world_y ~215 (back row) to
 * ~250 (front). Pallets are scattered across that grid like leftover stock.
 */
"use strict";

const Pallet_DIR = "assets/stages/kabatepe/Static/";
const Pallet_IMG = {};
["01", "02", "03", "04"].forEach(k => { const im = new Image(); im.src = Pallet_DIR + "wooden palet_" + k + ".png"; Pallet_IMG[k] = im; });

const Pallet_IMG_W = 1080;   // source canvas size

// ---- GROUP TRANSFORM — move / resize the WHOLE stash together, arrangement untouched ----
// Change these three to reposition or rescale everything at once (relative layout, stacking,
// tilts and flips all stay the same). The scale grows from ORIGIN (the stash's base centre).
const Pallet_SCALE   = 0.5;     // 1 = current size; 0.8 = smaller, 1.3 = bigger
const Pallet_SHIFT_X = 0;     // move whole stash: +right / -left  (world px)
const Pallet_SHIFT_Y = -25;     // move whole stash: +down/nearer / -up/further  (world px)
const Pallet_ORIGIN_X = 1460; // reference point the scaling grows from (stash base centre)
const Pallet_ORIGIN_Y = 234;  // stash ground line
// REFERENCE (current calibration SCALE 0.5 / SHIFT_Y -20): the stash resolves to world x ~1430..1484
// at base world_y ~212 (set back in the lot), with pallets ~18..26 world px wide (flat ~25, leaning
// ~22, weathered ~18) and a ~4 px stack step. Perspective at the play plane (y230) ≈ 36 world px/m.
// measured content anchors per sprite: cx = ground-contact centre x, bottom = ground-contact y,
// cw = content width (image px) — used to size each placement by its real width in world px.
const Pallet_META = {
  "01": { cx: 540, bottom: 969, cw: 830 },
  "02": { cx: 512, bottom: 1023, cw: 484 },
  "03": { cx: 555, bottom: 997, cw: 681 },
  "04": { cx: 549, bottom: 1003, cw: 607 }
};

// Placements, drawn in array order (back-to-front for correct overlap). w = the pallet's width in
// world px (SMALLER = further back for perspective). rot = radians tilt. flip mirrors it. yoff
// raises it off the ground (stacking). TUNE freely.
// One tidy corner stash: two neat stacks of flat pallets side by side (aligned on the same ground
// line), an upright pallet and a leaning one beside them, and a single flat pallet set down in
// front — like stock somebody stacked and left. Kept compact (world x ~1395..1545) and clear of the
// NPC further right. Stack layers share x/y and step up via yoff (8 px per pallet).
const Pallet_PLACES = [
  // leaning pallet propped against the left of the stash
  { k: "02", x: 1400, y: 230, w: 44, flip: false },
  // --- Stack A: 5 flat pallets, neatly stacked ---
  { k: "01", x: 1438, y: 229, w: 50 },
  { k: "01", x: 1439, y: 229, w: 50, flip: true, yoff: 8 },
  { k: "01", x: 1437, y: 229, w: 50, yoff: 16 },
  { k: "01", x: 1439, y: 229, w: 50, flip: true, yoff: 24 },
  { k: "01", x: 1438, y: 229, w: 50, yoff: 32 },
  // --- Stack B: 4 flat pallets, next to Stack A ---
  { k: "01", x: 1494, y: 229, w: 48, flip: true },
  { k: "01", x: 1495, y: 229, w: 48, yoff: 8 },
  { k: "01", x: 1493, y: 229, w: 48, flip: true, yoff: 16 },
  { k: "01", x: 1494, y: 229, w: 48, yoff: 24 },
  // a single flat pallet laid down in front, off to the right
  { k: "01", x: 1508, y: 234, w: 52, rot: 0.03 },
  // the weathered pallet — flipped, moved LEFT and IN FRONT, leaning on the stacks (drawn last = frontmost)
  { k: "04", x: 1462, y: 232, w: 36, flip: true, rot: -0.34 }
];

/* Draw one pallet so its ground-contact point (meta.cx, meta.bottom) sits at (p.x, p.y - yoff),
   with optional tilt/mirror. */
function drawOnePallet(p) {
  const m = Pallet_META[p.k], img = Pallet_IMG[p.k];
  if (!m || !(img && img.complete && img.naturalWidth > 0)) return;
  // apply the group transform: scale each pallet's size + its offset from the stash origin
  const scale = (p.w * Pallet_SCALE) / m.cw;
  const gx = Pallet_ORIGIN_X + Pallet_SHIFT_X + (p.x - Pallet_ORIGIN_X) * Pallet_SCALE;
  const gy = Pallet_ORIGIN_Y + Pallet_SHIFT_Y + (p.y - Pallet_ORIGIN_Y) * Pallet_SCALE;
  const gyoff = (p.yoff || 0) * Pallet_SCALE;
  ctx.save();
  ctx.translate(Math.round(gx), Math.round(gy - gyoff));
  if (p.rot) ctx.rotate(p.rot);
  if (p.flip) ctx.scale(-1, 1);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;   // smooth the big downscale
  ctx.drawImage(img, -m.cx * scale, -m.bottom * scale, Pallet_IMG_W * scale, Pallet_IMG_W * scale);
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();
}

/* World-space draw (called from renderGame, with the ground decor, behind the fighters). */
function drawPallets() {
  for (const p of Pallet_PLACES) drawOnePallet(p);
}
