/**
 * What Just Hit Me - static scaffold objects for Kabatepe.
 *
 * Plain script loaded after engine.js. Uses the engine's destructible props system.
 * Add, remove, or tune entries in Scaffold_PLACES to place more scaffolds.
 */
"use strict";

const Scaffold_DIR = "assets/stages/kabatepe/Static/";
const Scaffold_IMGS = {};
["01", "02"].forEach(k => {
  const im = new Image();
  im.src = Scaffold_DIR + "Scaffold_" + k + ".png";
  Scaffold_IMGS[k] = im;
});

// Source PNG resolution and measured anchor in image pixels (the PNGs are 642x642, 16-bit).
// bottom = content bottom (frame feet), platformY = the WOODEN DECK top (where fighters stand),
// cx = content centre x, w/h = content size. All measured from the actual pixels.
const Scaffold_IMG_W = 642;
const Scaffold_DEFAULT_DRAW = 85;
const Scaffold_ANCHORS = {
  "01": { cx: 321, bottom: 516, w: 411, h: 378, platformY: 293 },
  "02": { cx: 321, bottom: 577, w: 525, h: 506, platformY: 250 }
};

function scaffoldAnchor(key) {
  return Scaffold_ANCHORS[key || "01"] || Scaffold_ANCHORS["01"];
}

// x/y pin the measured anchor point to the map.
// draw/key/flip/angle/hp/support are optional. angle is in degrees.
// support can be one id or a list of ids. If any lower support breaks, this part breaks too.
// Your layout, sized/stacked to the real sprites. big = "01", small = "02".
//   Floor 1: three BIG modules side by side, on the ground (draw 116 -> ~74px wide, touch).
//            base 230 -> deck 190.
//   Floor 2: two SMALL (with a little gap) + one BIG on the right, all on floor-1 deck (190).
//            BIG deck 150, SMALL deck 152.
//   Floor 3: one BIG spanning the two smalls (base 152) + one SMALL on the big (base 150).
const Scaffold_PLACES = [
  // Floor 1: three big bottom modules.
  { id: "floor1_left", x: 491, y: 230, draw: 116, key: "01", hp: 130 },
  { id: "floor1_mid", x: 565, y: 230, draw: 116, key: "01", hp: 130 },
  { id: "floor1_right", x: 639, y: 230, draw: 116, key: "01", hp: 130 },

  // Floor 2: two small side modules (little gap between them) + one big on the right.
  { id: "floor2_left_small", x: 500, y: 190, draw: 74, key: "02", hp: 75, support: ["floor1_left", "floor1_mid"] },
  { id: "floor2_mid_small", x: 568, y: 190, draw: 74, key: "02", hp: 75, support: ["floor1_mid", "floor1_right"] },
  { id: "floor2_center", x: 639, y: 190, draw: 116, key: "01", hp: 110, support: "floor1_right" },

  // Floor 3: one big on the two smalls + one small on the big.
  { id: "floor3_center", x: 534, y: 152, draw: 116, key: "01", hp: 105, support: ["floor2_left_small", "floor2_mid_small"] },
  { id: "floor3_top", x: 639, y: 150, draw: 74, key: "02", hp: 70, support: "floor2_center" }
];

function buildScaffoldProps() {
  return Scaffold_PLACES.map(p => {
    const draw = p.draw || Scaffold_DEFAULT_DRAW;
    const key = p.key || "01";
    const a = scaffoldAnchor(key);
    const scale = draw / Scaffold_IMG_W;
    return {
      kind: "scaffold",
      scaffoldId: p.id,
      support: Array.isArray(p.support) ? p.support.slice() : (p.support ? [p.support] : []),
      x: p.x - a.w * scale / 2,
      w: a.w * scale,
      h: a.h * scale,
      baseY: p.y,
      anchorX: p.x,
      topY: p.topY===undefined ? p.y - (a.bottom - (p.platformY || a.platformY)) * scale + (p.topOffset || 0) : p.topY,
      draw,
      key,
      flip: !!p.flip,
      angle: p.angle || 0,
      hp: p.hp || 80,
      max: p.hp || 80
    };
  });
}

function drawScaffoldProp(p, t) {
  const img = Scaffold_IMGS[p.key || "01"];
  const draw = p.draw || Scaffold_DEFAULT_DRAW;
  const scale = draw / Scaffold_IMG_W;
  const angle = (p.angle || 0) * Math.PI / 180;
  const a = scaffoldAnchor(p.key);

  // Weakened (< 50% hp): it trembles and sheds wooden splinters — the visual "low health" cue.
  let shk = 0;
  if (p.max && p.hp > 0 && p.hp < p.max * 0.50) {
    const weak = 1 - p.hp / (p.max * 0.50);            // 0 at 50% hp -> 1 near death
    shk = Math.sin(t * 40 + p.anchorX) * (0.6 + weak * 1.8);
    if (typeof particles !== "undefined" && t >= (p._woodT || 0)) {
      p._woodT = t + 0.11 - weak * 0.06;               // sheds faster as it weakens
      const wx = p.anchorX + (Math.random() - 0.5) * p.w * 0.85;
      const wy = (p.topY !== undefined ? p.topY : p.baseY - p.h) + Math.random() * (p.h * 0.5);
      particles.push({ x: wx, y: wy, vx: rand(-14, 14), vy: rand(-6, 22), r: rand(1, 2.4),
        col: ["#6d5233", "#4a3722", "#8a6a42"][Math.floor(Math.random() * 3)], t: 0, life: rand(.4, .8) });
    }
  }

  ctx.save();
  ctx.translate(p.anchorX + shk, p.baseY);
  ctx.rotate(angle);
  if (p.flip) ctx.scale(-1, 1);

  if (img && img.complete && img.naturalWidth > 0) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      img,
      -a.cx * scale,
      -a.bottom * scale,
      draw,
      draw
    );
    ctx.imageSmoothingEnabled = sm;
  } else {
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(
      -a.cx * scale + draw * 0.25,
      -a.bottom * scale + draw * 0.25,
      draw * 0.5,
      draw * 0.5
    );
  }

  ctx.restore();
}

/* Collapse burst: a dust cloud billowing along the base + wood/metal debris flying out. */
function scaffoldCollapseFx(pr) {
  if (typeof particles === "undefined") return;
  const cx = (pr.anchorX !== undefined) ? pr.anchorX : pr.x + pr.w / 2;
  const topY = (pr.topY !== undefined) ? pr.topY : pr.baseY - pr.h;
  const botY = (pr.baseY !== undefined) ? pr.baseY : (typeof GROUND !== "undefined" ? GROUND : topY + pr.h);
  if (typeof shake !== "undefined") shake = Math.max(shake, 0.5);
  if (typeof spawnHitFx === "function") spawnHitFx(cx, (topY + botY) / 2, "#b09a6a", 10);
  // dust clouds — soft tan/grey, spread along the base and drift up
  for (let i = 0; i < 20; i++) {
    const dx = (Math.random() - 0.5) * pr.w * 1.15;
    particles.push({ x: cx + dx, y: botY - Math.random() * 8, vx: dx * rand(0.4, 1.4), vy: -rand(8, 46), r: rand(4, 9),
      col: ["#b9ad97", "#a89880", "#cfc4ad", "#9a8d76"][i % 4], t: 0, life: rand(.6, 1.3) });
  }
  // wood + metal debris flung outward
  for (let i = 0; i < 16; i++) {
    const ang = Math.random() * 6.283, sp = rand(45, 190);
    particles.push({ x: cx + (Math.random() - 0.5) * pr.w * 0.6, y: rand(topY, botY), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 45, r: rand(1.5, 3.5),
      col: ["#6d5233", "#4a3722", "#8a6a42", "#7a7f86", "#565c63"][i % 5], t: 0, life: rand(.5, 1.0) });
  }
}

function scaffoldBreakLinked(scaffold, owner) {
  for (const upper of props.slice()) {
    if (upper.kind === "scaffold" && upper.support && upper.support.includes(scaffold.scaffoldId) && upper.hp > 0) {
      damageProp(upper, upper.hp + 9999, null, true);   /* melee=true so the linked collapse still passes the scaffold gate */
    }
  }
}

function drawScaffold() {
  /* Scaffolds draw through drawStageObjects() as destructible props. */
}

function drawScaffoldPreview() {
  for (const p of Scaffold_PLACES) {
    const img = Scaffold_IMGS[p.key || "01"];
    const draw = p.draw || Scaffold_DEFAULT_DRAW;
    const scale = draw / Scaffold_IMG_W;
    const angle = (p.angle || 0) * Math.PI / 180;
    const a = scaffoldAnchor(p.key);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    if (p.flip) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        img,
        -a.cx * scale,
        -a.bottom * scale,
        draw,
        draw
      );
      ctx.imageSmoothingEnabled = sm;
    } else {
      ctx.fillStyle = "#8a8f96";
      ctx.fillRect(
        -a.cx * scale + draw * 0.25,
        -a.bottom * scale + draw * 0.25,
        draw * 0.5,
        draw * 0.5
      );
    }

    ctx.restore();
  }
}
