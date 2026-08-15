/**
 * One-frame static map Fishnetect template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every Fishnet_* constant and drawOneFrameFishnetectTemplate() with your Fishnetect's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourFishnetect() from renderGame() in js/engine.js.
 *
 * This matches the existing map-Fishnetect pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set Fishnet_IMG_W to 2048 and measure Fishnet_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * Fishnetects unless the Fishnet_* names are changed, because classic scripts share globals.
 */
"use strict";

const Fishnet_DIR = "assets/stages/kabatepe/Static/";
const Fishnet_IMG = new Image();
Fishnet_IMG.src = Fishnet_DIR + "Fishnet_01.png";

// World coordinates: tune these until the Fishnetect sits correctly on the map.
const Fishnet_DRAW = 40;       // draw size of the source canvas in world px
const Fishnet_X = 1075;         // world x of the measured anchor point
const Fishnet_Y = 190;         // world y of the measured anchor point/base

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 Fishnetect, start with { cx: 540, bottom: 972 }.
// If the Fishnetect floats/sinks or is off-center, measure the real base point in the PNG.
const Fishnet_IMG_W = 1080;
const Fishnet_ANCHOR = { cx: 540, bottom: 972 };

function drawFishnet() {
  const scale = Fishnet_DRAW / Fishnet_IMG_W;
  const dx = Fishnet_X - Fishnet_ANCHOR.cx * scale;
  const dy = Fishnet_Y - Fishnet_ANCHOR.bottom * scale;

  if (Fishnet_IMG.complete && Fishnet_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(Fishnet_IMG, dx, dy, Fishnet_DRAW, Fishnet_DRAW);
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + Fishnet_DRAW * 0.25, dy + Fishnet_DRAW * 0.25, Fishnet_DRAW * 0.5, Fishnet_DRAW * 0.5);
  }
}
