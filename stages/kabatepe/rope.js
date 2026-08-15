/**
 * What Just Hit Me — coiled mooring ROPES scattered on the Kabatepe pier near the boats.
 * Plain <script>, loaded AFTER engine.js (uses ctx). Pure static decoration, drawn behind the
 * fighters. Add/adjust entries in Rope_PLACES to move or add coils.
 */
"use strict";

const Rope_DIR = "assets/stages/kabatepe/Static/";
const Rope_IMG = new Image();
Rope_IMG.src = Rope_DIR + "Rope_01.png";

const Rope_IMG_W = 1080;    // source PNG size
const Rope_CX = 558;        // measured content centre x (image px)
const Rope_BOTTOM = 930;    // measured content bottom / where it rests (image px)

// One coil per boat, on the pier in front of it. Sizes follow the boats' perspective:
// big ferry -> big rope, small distant boat -> small rope. x/y/draw measured off the
// background (world_x = background_px * 1.016). Boats: ferry ~879, yacht ~1041, small ~1118.
const Rope_PLACES = [
  { x: 855,  y: 222, draw: 39, flip: false },   // by the white ferry (front, biggest)
  { x: 985, y: 216, draw: 28, flip: true  }   // by the dark yacht (medium)    // by the small boat (back, smallest)
];

/* World-space draw (called from renderGame — on the pier, behind the fighters). */
function drawRope() {
  if (!(Rope_IMG.complete && Rope_IMG.naturalWidth > 0)) return;
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  for (const p of Rope_PLACES) {
    const scale = p.draw / Rope_IMG_W;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(Rope_IMG, -Rope_CX * scale, -Rope_BOTTOM * scale, p.draw, p.draw);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = sm;
}
