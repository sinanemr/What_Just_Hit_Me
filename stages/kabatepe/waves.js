/**
 * What Just Hit Me — subtle animated water shimmer on the Kabatepe sea. Plain <script>, loaded
 * AFTER engine.js (uses ctx, tGlobal, STAGE_BG, WORLD_W, H). Twinkling glints, ADDITIVE-blended at
 * low opacity so they read as sunlight sparkling ON the water. Deterministic from tGlobal.
 *
 * The glints are gated by a SEA MASK built from the actual background pixels (getImageData): the
 * open water lies below the horizon (world_y ~168) and reads WARM (sunset reflection: R>B, R>=G,
 * not dark), while the sky is above it and the pier/grass/trees below are dark/green/grey. So the
 * shimmer only appears on real water, never in the sky or on the foreground.
 */
"use strict";

// ONLY the open sun-reflection water: between the trees/bollard on the left (~world 617) and the
// ferry on the right (~757). The center-left of the stage (İskele sign, KARATEPE Magaza sign, grass,
// scaffold) is dry LAND at this height — excluded by keeping the region here.
const WAVE_X_LEFT = 622, WAVE_X_RIGHT = 752;
const WAVE_Y_TOP = 174, WAVE_Y_BOT = 200;      // BELOW the horizon (~165 here) down to the near water edge
const WAVE_SUN_X = 718;                          // centre of the sun's reflection (warm glints cluster here)
const WAVE_COUNT = 120;                           // ripples generated (the mask discards those off-water)
const WAVE_CREST = 0.34;                          // brightness of the light crest
const WAVE_TROUGH = 0.14;                         // darkness of the shadow trough under each crest

// --- sea mask (built once from the background) ---
// The band above already excludes the SKY (it sits below the horizon line); the pixel mask then
// excludes FOREGROUND intrusions (green trees, the islet, grey pier) so glints land only on water.
const WAVE_MASK_Y0 = 172, WAVE_MASK_Y1 = 203;    // world-y span the mask covers
let Wave_mask = null;                            // Uint8Array grid over [X_LEFT..X_RIGHT] x [MASK_Y0..MASK_Y1]

/* deterministic pseudo-random 0..1 from an index. */
function waveHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* Build the sea mask by reading the background's pixels once STAGE_BG has loaded. Returns true when
   ready. Classifies each world cell as WATER = warm (R>B), non-green, not-dark, in the sea y-band. */
function buildSeaMask() {
  if (Wave_mask) return true;
  if (typeof STAGE_BG === "undefined" || !STAGE_BG.complete || !STAGE_BG.naturalWidth) return false;
  const iw = STAGE_BG.naturalWidth, ih = STAGE_BG.naturalHeight;
  let data;
  try {
    const cv = document.createElement("canvas"); cv.width = iw; cv.height = ih;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(STAGE_BG, 0, 0);
    data = g.getImageData(0, 0, iw, ih).data;
  } catch (e) { Wave_mask = false; return false; }   // tainted canvas (file://) -> skip masking, band alone is fine
  const sx = iw / WORLD_W, sy = ih / H;              // bg px per world unit
  const NX = WAVE_X_RIGHT - WAVE_X_LEFT, NY = WAVE_MASK_Y1 - WAVE_MASK_Y0;
  const m = new Uint8Array(NX * NY);
  for (let cy = 0; cy < NY; cy++) {
    const by = Math.min(ih - 1, Math.round((WAVE_MASK_Y0 + cy) * sy));
    for (let cx = 0; cx < NX; cx++) {
      const bx = Math.min(iw - 1, Math.round((WAVE_X_LEFT + cx) * sx));
      const i = (by * iw + bx) * 4, r = data[i], g2 = data[i + 1], b = data[i + 2];
      const sea = (r > b + 18) && (r >= g2) && (r + g2 + b > 210);   // warm & bright sunset water, not grass/pier/tree
      m[cy * NX + cx] = sea ? 1 : 0;
    }
  }
  Wave_mask = m; return true;
}
function waveIsSea(x, y) {
  if (!Wave_mask) return true;                        // mask not built/available -> rely on the y-band only
  const cx = Math.round(x) - WAVE_X_LEFT, cy = Math.round(y) - WAVE_MASK_Y0;
  const NX = WAVE_X_RIGHT - WAVE_X_LEFT, NY = WAVE_MASK_Y1 - WAVE_MASK_Y0;
  if (cx < 0 || cx >= NX || cy < 0 || cy >= NY) return false;
  return Wave_mask[cy * NX + cx] === 1;
}

/* World-space draw (called from renderGame, right after the backdrop). */
function drawWaves() {
  buildSeaMask();
  const t = tGlobal;
  ctx.save();
  for (let i = 0; i < WAVE_COUNT; i++) {
    const bx = WAVE_X_LEFT + waveHash(i * 2 + 1) * (WAVE_X_RIGHT - WAVE_X_LEFT);
    const by = WAVE_Y_TOP + waveHash(i * 7 + 3) * (WAVE_Y_BOT - WAVE_Y_TOP);
    const rate = 0.8 + waveHash(i * 5 + 2) * 1.5;
    const on = 0.5 + 0.5 * Math.sin(t * rate + waveHash(i * 3) * 6.283);   // each ripple shimmers on its own phase
    if (on < 0.3) continue;
    const str = (on - 0.3) / 0.7;                                          // 0..1 strength
    const dx = Math.sin(t * 0.6 + i * 1.3) * 3;                            // gentle horizontal drift
    const x = Math.round(bx + dx), y = Math.round(by);
    if (!waveIsSea(x, y)) continue;                                        // only draw ON the water
    const w = Math.round(3 + waveHash(i * 11 + 4) * 6);
    const sunW = Math.max(0, 1 - Math.abs(bx - WAVE_SUN_X) / 280);         // warmth near the sun's path
    // bright crest (additive light on the water)
    ctx.globalCompositeOperation = "lighter";
    const r = Math.round(210 + 45 * sunW), g = Math.round(200 + 35 * sunW), b = Math.round(180 + 10 * sunW);
    ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (WAVE_CREST * str).toFixed(3) + ")";
    ctx.fillRect(x, y, w, 1);
    // dark trough just below -> contrast so the ripple reads on bright water
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(38,28,52," + (WAVE_TROUGH * str).toFixed(3) + ")";
    ctx.fillRect(x + 1, y + 1, w - 1, 1);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}
