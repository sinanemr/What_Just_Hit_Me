/**
 * What Just Hit Me — background NPC for the Kabatepe stage: a kid sitting on top of the boat
 * eating from a snack box. Plain <script>, loaded AFTER engine.js (uses ctx, tGlobal). Pure
 * decoration — drawn in front of the boat but BEHIND the fighters; animation is driven by
 * the synced tGlobal so host and guest match (no sync).
 *
 * Three frames cycle as an eating loop: reach into the box -> hand to mouth -> toss crumbs.
 * Only the arms move, so all frames draw at the same base rect; a small per-frame x offset
 * (KID_FDX) lines the body up if a frame's art is shifted (measured once the PNGs are placed).
 */
"use strict";

const KID_DIR = "assets/stages/kabatepe/kid/";
const KID_IMG = {};
["frame1", "frame2", "frame3"].forEach(k => { const im = new Image(); im.src = KID_DIR + k + ".png"; KID_IMG[k] = im; });

// --- placement / size (world coords) — TUNE ---
const KID_DRAW = 46;        // draw size of the 1080 canvas (world px); small background figure
const KID_X = 820;          // world x (on top of the boat)
const KID_Y = 153;          // world y of his seat (on the boat deck); larger = lower/forward
const KID_CX_FRAC = 0.50;   // where the figure sits horizontally within the sprite (0..1)
const KID_BASE_FRAC = 0.78; // where his seat/feet sit vertically within the sprite (0..1) — raise if he floats
// per-frame horizontal alignment (image px); frame1 is the reference, others shifted to match.
// Filled in after measuring the placed PNGs.
const KID_FDX = { frame1: 0, frame2: 37, frame3: 39 };   // measured: f2 body sits +37px, f3 +39px vs f1

// --- eat cycle: mostly idle on frame1; on ~70% of cycles he EATS — frame2 (hand to mouth)
//     and then frame3 (toss crumbs) ALWAYS follows — then back to idle ---
const KID_PERIOD = 3.2;          // seconds per cycle
const KID_EAT_CHANCE = 0.7;      // fraction of cycles where he eats (frame2 -> frame3)
const KID_EAT_START = 1.0;       // when in the cycle the eat begins
const KID_F2_DUR = 0.55;         // frame2 (hand to mouth) duration
const KID_F3_DUR = 0.6;          // frame3 (toss crumbs) duration — always right after frame2

/* deterministic pseudo-random 0..1 from a cycle index (keeps the timing identical host/guest). */
function kidHash(n) { let h = (n * 374761393 + 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* World-space draw (called from renderGame, just after drawCars — in front of the boat,
   behind the fighters). */
function drawKid() {
  const phase = tGlobal % KID_PERIOD;
  const cyc = Math.floor(tGlobal / KID_PERIOD);
  let key = "frame1";
  if (kidHash(cyc) < KID_EAT_CHANCE) {            // this cycle he eats: frame2, then frame3 always follows
    if (phase >= KID_EAT_START && phase < KID_EAT_START + KID_F2_DUR) key = "frame2";
    else if (phase >= KID_EAT_START + KID_F2_DUR && phase < KID_EAT_START + KID_F2_DUR + KID_F3_DUR) key = "frame3";
  }
  const img = KID_IMG[key];
  const scale = KID_DRAW / 1080;
  const dx = KID_X - KID_CX_FRAC * KID_DRAW - (KID_FDX[key] || 0) * scale;   // align each frame to frame1
  const dy = KID_Y - KID_BASE_FRAC * KID_DRAW;
  if (img && img.complete && img.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;             // smooth the heavy 1080->small downscale so he isn't jagged/low-res
    ctx.drawImage(img, dx, dy, KID_DRAW, KID_DRAW);
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#7a6a58"; ctx.fillRect(KID_X - KID_DRAW * 0.15, KID_Y - KID_DRAW * 0.4, KID_DRAW * 0.3, KID_DRAW * 0.4);
  }
}
