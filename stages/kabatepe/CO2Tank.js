/**
 * One-frame static map CO2Tankect template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every CO2Tank_* constant and drawOneFrameCO2TankectTemplate() with your CO2Tankect's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourCO2Tankect() from renderGame() in js/engine.js.
 *
 * This matches the existing map-CO2Tankect pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set CO2Tank_IMG_W to 2048 and measure CO2Tank_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * CO2Tankects unless the CO2Tank_* names are changed, because classic scripts share globals.
 */
"use strict";

const CO2Tank_DIR = "assets/stages/kabatepe/Static/";
const CO2Tank_IMG = new Image();
CO2Tank_IMG.src = CO2Tank_DIR + "CO2_Tank_02.png";

// World coordinates: tune these until the CO2Tankect sits correctly on the map.
const CO2Tank_DRAW = 90;       // draw size of the source canvas in world px
const CO2Tank_X = 900;         // world x of the measured anchor point
const CO2Tank_Y = 275;         // world y of the measured anchor point/base

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 CO2Tankect, start with { cx: 540, bottom: 972 }.
// If the CO2Tankect floats/sinks or is off-center, measure the real base point in the PNG.
const CO2Tank_IMG_W = 1080;
const CO2Tank_ANCHOR = { cx: 540, bottom: 972 };

function drawCO2Tank() {
  const scale = CO2Tank_DRAW / CO2Tank_IMG_W;
  const dx = CO2Tank_X - CO2Tank_ANCHOR.cx * scale;
  const dy = CO2Tank_Y - CO2Tank_ANCHOR.bottom * scale;

  if (CO2Tank_IMG.complete && CO2Tank_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(CO2Tank_IMG, dx, dy, CO2Tank_DRAW, CO2Tank_DRAW);
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + CO2Tank_DRAW * 0.25, dy + CO2Tank_DRAW * 0.25, CO2Tank_DRAW * 0.5, CO2Tank_DRAW * 0.5);
  }
}
