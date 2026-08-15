/**
 * What Just Hit Me — metal IRONBOXES (Ironbox_01) around and ON TOP of the scaffolds (stages/kabatepe/scaffold.js).
 * Plain <script>, loaded AFTER engine.js AND scaffold.js (reads the live `props`). Decoration, drawn
 * after the scaffolds and behind the fighters.
 *
 * A placement is either:
 *   - onScaffold: "<scaffoldId>"  -> rides that scaffold's deck (uses its live anchorX/topY). When
 *                                    that scaffold is destroyed (gone from props), the box is
 *                                    destroyed too — it stops drawing and bursts into debris.
 *   - x / y (world)               -> a box sitting on the ground around the base (independent).
 */
"use strict";

const Iron_DIR = "assets/stages/kabatepe/Static/";
const Iron_IMG = new Image();
Iron_IMG.src = Iron_DIR + "Ironbox_01.png";

const Iron_IMG_W = 1080;
const Iron_CX = 540, Iron_BOTTOM = 827, Iron_CW = 543;   // measured content: centre x, ground-contact bottom, width
const Iron_SCALE = 0.65;   // resize all boxes together (tuning)

// dx/dy nudge an on-scaffold box on its deck; w = box width (world px); rot/flip for variety.
const Iron_PLACES = [
  // ON TOP of scaffolds — each is destroyed together with its scaffold
  { onScaffold: "floor3_center", dx: -2, w: 32 },              // on the top big platform
  { onScaffold: "floor2_center", dx: 2, w: 30, flip: true },   // on the mid-right platform
  // AROUND the base, on the ground (independent of the scaffolds)
  { x: 570, y: 226, w: 34, rot: -0.02, flip: true }
];

/* debris burst when a box's scaffold collapses under it. */
function ironboxBreakFx(b) {
  if (typeof particles === "undefined" || b._lastX === undefined) return;
  const cx = b._lastX, cy = b._lastY;
  if (typeof shake !== "undefined") shake = Math.max(shake, 0.3);
  if (typeof spawnHitFx === "function") spawnHitFx(cx, cy - 6, "#7a8590", 8);
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * 6.283, sp = rand(40, 160);
    particles.push({ x: cx + (Math.random() - 0.5) * (b._lastW || 24), y: cy - Math.random() * 10,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40, r: rand(1.5, 3),
      col: ["#7a8590", "#565c63", "#3a4048", "#9fb0bd"][i % 4], t: 0, life: rand(.5, 1.0) });
  }
}

function drawOneIron(b, x, y) {
  const scale = (b.w * Iron_SCALE) / Iron_CW;
  b._lastX = x; b._lastY = y; b._lastW = b.w * Iron_SCALE;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (b.rot) ctx.rotate(b.rot);
  if (b.flip) ctx.scale(-1, 1);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(Iron_IMG, -Iron_CX * scale, -Iron_BOTTOM * scale, Iron_IMG_W * scale, Iron_IMG_W * scale);
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();
}

/* World-space draw — after the scaffolds, behind the fighters. */
function drawIronboxes() {
  if (!(Iron_IMG.complete && Iron_IMG.naturalWidth > 0)) return;
  for (const b of Iron_PLACES) {
    if (b.onScaffold) {
      const sc = (typeof props !== "undefined")
        ? props.find(p => p.kind === "scaffold" && p.scaffoldId === b.onScaffold && p.hp > 0) : null;
      if (!sc) { if (!b._gone) { b._gone = true; ironboxBreakFx(b); } continue; }  // scaffold gone -> box destroyed
      b._gone = false;                                                             // (reset each new round)
      drawOneIron(b, sc.anchorX + (b.dx || 0), sc.topY + (b.dy || 0));
    } else {
      drawOneIron(b, b.x, b.y);
    }
  }
}
