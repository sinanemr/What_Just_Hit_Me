/**
 * One-frame static map object template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every OBJ_* constant and drawOneFrameObjectTemplate() with your object's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourObject() from renderGame() in js/engine.js.
 *
 * This matches the existing map-object pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set OBJ_IMG_W to 2048 and measure OBJ_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * objects unless the OBJ_* names are changed, because classic scripts share globals.
 */
"use strict";

const WetsuitsDry_DIR = "assets/stages/kabatepe/Static/";
const WetsuitsDry_IMG = new Image();
WetsuitsDry_IMG.src = WetsuitsDry_DIR + "WetsuitsDry_01.png";

// World coordinates: tune these until the object sits correctly on the map.
const WetsuitsDry_DRAW = 75;       // draw size of the source canvas in world px
const WetsuitsDry_X = 920;         // world x of the measured anchor point
const WetsuitsDry_Y = 222;         // world y of the measured anchor point/base

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 object, start with { cx: 540, bottom: 972 }.
// If the WetsuitsDryect floats/sinks or is off-center, measure the real base point in the PNG.
const WetsuitsDry_IMG_W = 1080;
const WetsuitsDry_ANCHOR = { cx: 540, bottom: 972 };

function drawWetsuitsDry() {
  const scale = WetsuitsDry_DRAW / WetsuitsDry_IMG_W;
  const dx = WetsuitsDry_X - WetsuitsDry_ANCHOR.cx * scale;
  const dy = WetsuitsDry_Y - WetsuitsDry_ANCHOR.bottom * scale;

  if (WetsuitsDry_IMG.complete && WetsuitsDry_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(WetsuitsDry_IMG, dx, dy, WetsuitsDry_DRAW, WetsuitsDry_DRAW);
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + WetsuitsDry_DRAW * 0.25, dy + WetsuitsDry_DRAW * 0.25, WetsuitsDry_DRAW * 0.5, WetsuitsDry_DRAW * 0.5);
  }
}
