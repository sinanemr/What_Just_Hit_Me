/**
 * What Just Hit Me — ambient SEAGULLS flying across the Kabatepe sky. Plain <script>, loaded
 * AFTER engine.js (uses ctx, tGlobal, WORLD_W). Pure decoration — drawn in the sky behind
 * everything. Each bird's whole path is a deterministic function of tGlobal (no stored state),
 * so host and guest match with no sync. Each pass picks a fresh random height + direction.
 *
 * Two frames flap the wings (wings up / wings down).
 */
"use strict";

const BIRD_DIR = "assets/stages/kabatepe/bird/";
const BIRD_IMG = {};
["frame1", "frame2"].forEach(k => { const im = new Image(); im.src = BIRD_DIR + k + ".png"; BIRD_IMG[k] = im; });

const BIRD_BASE_FACE = 1;   // sprite faces RIGHT (set -1 if the art faces left)
const BIRD_SKY_TOP = -20;   // world y at the top of the band birds fly in (negative = higher up)
const BIRD_SKY_RANGE = 105; // vertical spread of the band (world px); kept up in the far sky
const BIRD_MARGIN = 130;    // how far off each side they spawn/exit (world px)
const BIRD_TILT_AMP = 3.2;  // how strongly the sprite noses up/down toward its climb/descent
const BIRD_MAX_TILT = 0.42; // clamp on that tilt (rad, ~24 deg)

// Each slot loops: crosses over `travel` s, then a gap; every pass hashes a fresh entry AND
// exit height + direction, so they fly diagonally in varied directions. They sit far away in
// the depth of the scene: small, and the smaller/further ones cross MORE SLOWLY (bigger travel).
const BIRDS = [
  { off: 0.0,  cycle: 26, travel: 19,  size: 23, flap: 5.0, bob: 2 },
  { off: 6.3,  cycle: 32, travel: 25,  size: 15, flap: 5.8, bob: 1.3 },
  { off: 12.1, cycle: 23, travel: 16,  size: 29, flap: 4.5, bob: 2.5 },
  { off: 17.7, cycle: 36, travel: 28,  size: 13, flap: 6.2, bob: 1.1 },
  { off: 23.4, cycle: 29, travel: 22,  size: 19, flap: 5.4, bob: 1.7 }
];

/* deterministic pseudo-random 0..1 from an index (keeps every pass identical host/guest). */
function birdHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, just after drawStage — behind everything). */
function drawBirds() {
  if (typeof WORLD_W === "undefined") return;
  for (let i = 0; i < BIRDS.length; i++) {
    const b = BIRDS[i];
    const local = tGlobal + b.off;
    const loopN = Math.floor(local / b.cycle);
    const inCycle = local - loopN * b.cycle;          // 0..cycle
    if (inCycle > b.travel) continue;                 // off-screen during the gap between passes
    const progress = inCycle / b.travel;              // 0..1 across the sky
    const dir = birdHash(loopN * 13 + i * 7) < 0.5 ? 1 : -1;
    const startX = dir > 0 ? -BIRD_MARGIN : WORLD_W + BIRD_MARGIN;
    const endX = dir > 0 ? WORLD_W + BIRD_MARGIN : -BIRD_MARGIN;
    const entryY = BIRD_SKY_TOP + birdHash(loopN * 29 + i * 5) * BIRD_SKY_RANGE;
    const exitY = BIRD_SKY_TOP + birdHash(loopN * 47 + i * 11) * BIRD_SKY_RANGE;   // different -> diagonal path
    const x = startX + (endX - startX) * progress;
    const y = entryY + (exitY - entryY) * progress + Math.sin(tGlobal * 2.2 + i) * b.bob;
    // tilt the sprite toward its climb/descent (amplified so the diagonal reads); the flip for
    // left-travel is done by rotating to the heading then mirroring vertically to stay upright.
    const rawPitch = Math.atan2(exitY - entryY, Math.abs(endX - startX));
    const pitch = Math.max(-BIRD_MAX_TILT, Math.min(BIRD_MAX_TILT, rawPitch * BIRD_TILT_AMP));
    const ang = Math.atan2(Math.sin(pitch), dir * Math.cos(pitch));
    const key = (Math.floor(tGlobal * b.flap) % 2) ? "frame2" : "frame1";
    const img = BIRD_IMG[key];
    const sz = b.size;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    if (Math.cos(ang) < 0) ctx.scale(1, -1);          // heading left -> mirror vertically so it stays upright
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;                 // smooth the heavy downscale so they aren't jagged
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
    } else {
      ctx.fillStyle = "#dfe4ea"; ctx.fillRect(-sz * 0.3, -sz * 0.05, sz * 0.6, sz * 0.1);
    }
    ctx.imageSmoothingEnabled = sm;
    ctx.restore();
  }
}
