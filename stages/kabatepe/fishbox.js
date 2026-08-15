/**
 * One-frame static map Fishboxect template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every Fishbox_* constant and drawOneFrameFishboxectTemplate() with your Fishboxect's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourFishboxect() from renderGame() in js/engine.js.
 *
 * This matches the existing map-Fishboxect pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set Fishbox_IMG_W to 2048 and measure Fishbox_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * Fishboxects unless the Fishbox_* names are changed, because classic scripts share globals.
 */
"use strict";

const Fishbox_DIR = "assets/stages/kabatepe/Static/";
const Fishbox_IMG = new Image();
Fishbox_IMG.src = Fishbox_DIR + "Fishbox_01.png";

// World coordinates: tune these until the Fishboxect sits correctly on the map.
const Fishbox_DRAW = 50;       // draw size of the source canvas in world px
const Fishbox_PLACES = [
  { x: 745, y: 208 }, // top fishbox
  { x: 740, y: 218 }  // bottom fishbox
];

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 Fishboxect, start with { cx: 540, bottom: 972 }.
// If the Fishboxect floats/sinks or is off-center, measure the real base point in the PNG.
const Fishbox_IMG_W = 1080;
const Fishbox_ANCHOR = { cx: 540, bottom: 972 };

function drawFishbox() {
  const scale = Fishbox_DRAW / Fishbox_IMG_W;

  if (Fishbox_IMG.complete && Fishbox_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    for (const p of Fishbox_PLACES) {
      const dx = p.x - Fishbox_ANCHOR.cx * scale;
      const dy = p.y - Fishbox_ANCHOR.bottom * scale;
      ctx.drawImage(Fishbox_IMG, dx, dy, Fishbox_DRAW, Fishbox_DRAW);
    }
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    for (const p of Fishbox_PLACES) {
      const dx = p.x - Fishbox_ANCHOR.cx * scale;
      const dy = p.y - Fishbox_ANCHOR.bottom * scale;
      ctx.fillRect(
        dx + Fishbox_DRAW * 0.25,
        dy + Fishbox_DRAW * 0.25,
        Fishbox_DRAW * 0.5,
        Fishbox_DRAW * 0.5
      );
    }
  }
}
