/**
 * One-frame static map FishingRodect template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every FishingRod_* constant and drawOneFrameFishingRodectTemplate() with your FishingRodect's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourFishingRodect() from renderGame() in js/engine.js.
 *
 * This matches the existing map-FishingRodect pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set FishingRod_IMG_W to 2048 and measure FishingRod_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * FishingRodects unless the FishingRod_* names are changed, because classic scripts share globals.
 */
"use strict";

const FishingRod_DIR = "assets/stages/kabatepe/Static/";
const FishingRod_IMG = new Image();
FishingRod_IMG.src = FishingRod_DIR + "FishingRod_01.png";

// World coordinates: tune these until the FishingRodect sits correctly on the map.
const FishingRod_DRAW = 45;       // draw size of the source canvas in world px
const FishingRod_X = 740;         // world x of the measured anchor point
const FishingRod_Y = 205;         // world y of the measured anchor point/base
const FishingRod_ANGLE = 70 * Math.PI / 180;

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 FishingRodect, start with { cx: 540, bottom: 972 }.
// If the FishingRodect floats/sinks or is off-center, measure the real base point in the PNG.
const FishingRod_IMG_W = 1080;
const FishingRod_ANCHOR = { cx: 540, bottom: 972 };

function drawFishingRod() {
  const scale = FishingRod_DRAW / FishingRod_IMG_W;
  const dx = FishingRod_X - FishingRod_ANCHOR.cx * scale;
  const dy = FishingRod_Y - FishingRod_ANCHOR.bottom * scale;

  if (FishingRod_IMG.complete && FishingRod_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.save();
    ctx.translate(FishingRod_X, FishingRod_Y);
    ctx.rotate(FishingRod_ANGLE);
    ctx.drawImage(
      FishingRod_IMG,
      -FishingRod_ANCHOR.cx * scale,
      -FishingRod_ANCHOR.bottom * scale,
      FishingRod_DRAW,
      FishingRod_DRAW
    );
    ctx.restore();
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + FishingRod_DRAW * 0.25, dy + FishingRod_DRAW * 0.25, FishingRod_DRAW * 0.5, FishingRod_DRAW * 0.5);
  }
}
