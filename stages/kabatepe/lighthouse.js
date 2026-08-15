/**
 * One-frame static map LightHouseect template.
 *
 * How to use:
 * 1. Copy this file and rename it, for example js/statue.js.
 * 2. Replace every LightHouse_* constant and drawOneFrameLightHouseectTemplate() with your LightHouseect's name.
 * 3. Put the PNG at assets/stages/kabatepe/YOUR_FOLDER/frame1.png.
 * 4. Add the new script to RUN_GAME.html after engine.js.
 * 5. Call drawYourLightHouseect() from renderGame() in js/engine.js.
 *
 * This matches the existing map-LightHouseect pattern: source art is usually a 1080x1080 PNG,
 * then DRAW scales that full source canvas down into world pixels.
 * If the source is 2048x2048, set LightHouse_IMG_W to 2048 and measure LightHouse_ANCHOR in
 * that 2048px source image. Do not load this template file directly with other copied
 * LightHouseects unless the LightHouse_* names are changed, because classic scripts share globals.
 */
"use strict";

const LightHouse_DIR = "assets/stages/kabatepe/Static/";
const LightHouse_IMG = new Image();
LightHouse_IMG.src = LightHouse_DIR + "LightHouse_01.png";

// World coordinates: tune these until the LightHouseect sits correctly on the map.
const LightHouse_DRAW = 265;       // draw size of the source canvas in world px
const LightHouse_X = 617;         // world x of the measured anchor point
const LightHouse_Y = 221;         // world y of the measured anchor point/base
// The four standable levels you marked, given in SOURCE-IMAGE pixels (the PNG is 2048x2048):
//   srcY = the deck/landing surface, srcX = its centre, srcW = its width. Tune these to the art.
const LightHouse_LEVELS = [
  { srcY: 505,  srcX: 1023, srcW: 460 },                 // 1: top gallery deck
  { srcY: 865,  srcX: 1261, srcW: 222 },                 // 2: upper-right staircase landing
  { srcY: 1244, srcX: 759,  srcW: 162, gated: true },    // 3: mid-left  (opens when scaffold demolished)
  { srcY: 1532, srcX: 1288, srcW: 167, gated: true },    // 4: lower-right (opens when scaffold demolished)
  { srcY: 1857, srcX: 1023, srcW: 880, gated: true }     // 5: base       (opens when scaffold demolished)
];
// TEMP: draw the platform lines so we can align them from a screenshot. Set to false when done.
const LightHouse_DEBUG = false;
// A level is blocked (not standable) while a DESTRUCTIBLE platform (scaffold) sits within this
// many world px directly above it; once that platform is destroyed, the level opens up.
const LightHouse_BLOCK_GAP = 46;

// Source PNG resolution and measured anchor in image pixels.
// For a normal centered 1080x1080 LightHouseect, start with { cx: 540, bottom: 972 }.
// If the LightHouseect floats/sinks or is off-center, measure the real base point in the PNG.
const LightHouse_IMG_W = 2048;
const LightHouse_ANCHOR = { cx: 1024, bottom: 2047 };

function buildLightHousePlatforms() {
  const scale = LightHouse_DRAW / LightHouse_IMG_W;
  // Scaffold ("construction") pieces still standing in front of the lighthouse.
  const scaffolds = (typeof props !== "undefined") ? props.filter(p => p.kind === "scaffold" && p.hp > 0) : [];
  const out = [];
  for (const lv of LightHouse_LEVELS) {
    const y = LightHouse_Y - (LightHouse_ANCHOR.bottom - lv.srcY) * scale;
    const w = lv.srcW * scale;
    const x = LightHouse_X + (lv.srcX - LightHouse_ANCHOR.cx) * scale - w / 2;
    // Gated levels stay OFF until the scaffolding covering that x is demolished.
    if (lv.gated) {
      const stillCovered = scaffolds.some(s => (s.x + s.w) > x + 4 && s.x < x + w - 4);
      if (stillCovered) continue;
    }
    out.push({ kind: "lighthouseTop", x, y, w, hidden: true });
  }
  return out;
}

function drawLightHouse() {
  const scale = LightHouse_DRAW / LightHouse_IMG_W;
  const dx = LightHouse_X - LightHouse_ANCHOR.cx * scale;
  const dy = LightHouse_Y - LightHouse_ANCHOR.bottom * scale;

  if (LightHouse_IMG.complete && LightHouse_IMG.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(LightHouse_IMG, dx, dy, LightHouse_DRAW, LightHouse_DRAW);
    ctx.imageSmoothingEnabled = sm;
    if (LightHouse_DEBUG) {   // TEMP alignment tools: a source-pixel ruler + the level lines
      const sc = LightHouse_DRAW / LightHouse_IMG_W;
      const toY = s => LightHouse_Y - (LightHouse_ANCHOR.bottom - s) * sc;
      const rx0 = LightHouse_X - 620 * sc, rx1 = LightHouse_X + 470 * sc;
      ctx.font = "7px monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      for (let s = 300; s <= 1980; s += 50) {          // ruler: labelled every 200 source px
        const y = toY(s), major = (s % 200 === 0);
        ctx.fillStyle = major ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.28)";
        ctx.fillRect(rx0, y, rx1 - rx0, 1);
        if (major) { ctx.fillStyle = "#ffffff"; ctx.fillText(String(s), rx1 + 3, y); }
      }
      const cols = ["#00ff55", "#ffe000", "#ff2fd0", "#00d0ff", "#ff3030"];
      for (let i = 0; i < LightHouse_LEVELS.length; i++) {
        const lv = LightHouse_LEVELS[i], y = toY(lv.srcY);
        const w = lv.srcW * sc, x = LightHouse_X + (lv.srcX - LightHouse_ANCHOR.cx) * sc - w / 2;
        ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x, y - 1, w, 3);
        ctx.fillRect(x, y - 7, 2, 7); ctx.fillRect(x + w - 2, y - 7, 2, 7);
      }
    }
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(dx + LightHouse_DRAW * 0.25, dy + LightHouse_DRAW * 0.25, LightHouse_DRAW * 0.5, LightHouse_DRAW * 0.5);
  }
}
