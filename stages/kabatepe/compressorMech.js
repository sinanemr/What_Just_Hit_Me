/**
 * One-frame static map CompMechect template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every CompMech_* constant and drawOneFrameCompMechectTemplate() with your CompMechect's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourCompMechect() from renderGame() in js/engine.js.
 *
 * This matches the existing map-CompMechect pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set CompMech_IMG_W to 2048 and measure CompMech_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * CompMechects unless the CompMech_* names are changed, because classic scripts share globals.
 */
"use strict";

const CompMech_DIR = "assets/stages/kabatepe/Static/";
const CompMech_IMG = new Image();
CompMech_IMG.src = CompMech_DIR + "Compressor.png";

// World coordinates: tune these until the CompMechect sits correctly on the map.
const CompMech_DRAW = 50;       // draw size of the source canvas in world px
const CompMech_X = 1035;         // world x of the measured anchor point
const CompMech_Y = 210;         // world y of the measured anchor point/base

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 CompMechect, start with { cx: 540, bottom: 972 }.
// If the CompMechect floats/sinks or is off-center, measure the real base point in the PNG.
const CompMech_IMG_W = 1080;
const CompMech_ANCHOR = { cx: 540, bottom: 972 };

function drawCompMech() {
  const scale = CompMech_DRAW / CompMech_IMG_W;
  const dx = CompMech_X - CompMech_ANCHOR.cx * scale;
  const dy = CompMech_Y - CompMech_ANCHOR.bottom * scale;

  if (CompMech_IMG.complete && CompMech_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(CompMech_IMG, dx, dy, CompMech_DRAW, CompMech_DRAW);
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + CompMech_DRAW * 0.25, dy + CompMech_DRAW * 0.25, CompMech_DRAW * 0.5, CompMech_DRAW * 0.5);
  }
}
