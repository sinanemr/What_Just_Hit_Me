/**
 * What Just Hit Me — a destructible, standable, EXPLODING car on the Kabatepe pier.
 * Plain <script>, loaded AFTER engine.js AND cars.js (reuses spawnCarBlast / drawWreckFire).
 *
 * Registered as a destructible prop (kind:"car") via buildCarProps(); its roof is a one-way
 * platform so players can stand on top. Attack it down to 0 hp (no health bar — it trembles
 * like the scaffolds) and it EXPLODES: damage + knockback + BURN + knockdown to nearby
 * fighters (same feel as cars.js), then it stays as the wrecked sprite, still burning.
 */
"use strict";

const Car_DIR = "assets/stages/kabatepe/Static/Car/";
const Car_IMG = {};
["Car_side", "Car_side_destroyed"].forEach(k => { const im = new Image(); im.src = Car_DIR + k + ".png"; Car_IMG[k] = im; });

// Measured content in the 642px CLEAN sprite: centre x, wheel bottom, roof top, body left/right/top.
const Car_IMG_W = 642;
const Car_CX = 320, Car_BOTTOM = 441, Car_ROOF = 218, Car_LEFT = 21, Car_RIGHT = 619, Car_TOP = 211;
// The DESTROYED sprite sits lower in its own canvas — its own wheel-bottom/centre so the wreck lines
// up on the same ground line as the clean car when it swaps in.
const Car_D_CX = 314, Car_D_BOTTOM = 641;
// Cabin ROOF span (image px) — the flat greenhouse you actually stand on, NOT the sloped hood that
// runs off to the right. Measured from the sprite: roof plateau ≈ x90..410 across the top rows.
// The walk-platform uses this (not the full body) so a fighter stands on the roof like the blue
// outline and can't float out past the cabin edge over the hood.
const Car_ROOF_L = 90, Car_ROOF_R = 410;
// HOOD / cowling (image px) — the lower flat deck at the FRONT (right) of the car, below the roof.
// Measured surface: x≈445..585 sits at y≈495..510 (it steps down from the windshield). A second,
// lower platform here lets fighters stand on the hood and step up onto the roof.
const Car_HOOD_L = 445, Car_HOOD_R = 585, Car_HOOD = 298;

// --- placement / size (world coords) — TUNE (middle, in front of the boats) ---
const Car_X = 1140;      // world x
const Car_Y = 230;       // world y = GROUND (players' level, wheels on the pier)
const Car_DRAW = 150;    // draw size of the 642 canvas (world px)
const Car_HP = 150;      // hits to blow it up (no bar — it trembles as it weakens)

// --- explosion (same idea/range as cars.js) ---
const Car_BOOM_DMG = 24, Car_BOOM_KB = 380, Car_BOOM_RANGE = 170;   // blast damage/knockback reach
const Car_BOOM_BURN_DPS = 10, Car_BOOM_BURN_SEC = 4;
// --- lingering wreck fire: standing ON TOP of the burning wreck (roof/hood) keeps you burning ---
const Car_FIRE_BURN_DPS = 8, Car_FIRE_BURN_SEC = 2;

function buildCarProps() {
  const scale = Car_DRAW / Car_IMG_W;
  return [{
    kind: "car",
    x: Car_X - (Car_CX - Car_LEFT) * scale,          // full BODY left edge (hits + draw anchor)
    w: (Car_RIGHT - Car_LEFT) * scale,               // full body width — you can hit the whole car
    h: (Car_BOTTOM - Car_TOP) * scale,               // body height (for hit detection)
    baseY: Car_Y,
    anchorX: Car_X,
    topY: Car_Y - (Car_BOTTOM - Car_ROOF) * scale,   // roof surface = the platform's Y
    roofX: Car_X - (Car_CX - Car_ROOF_L) * scale,    // CABIN span -> the upper standable platform
    roofW: (Car_ROOF_R - Car_ROOF_L) * scale,        // (roof, not the sloped hood)
    hoodX: Car_X - (Car_CX - Car_HOOD_L) * scale,    // HOOD span -> the lower standable platform
    hoodW: (Car_HOOD_R - Car_HOOD_L) * scale,
    hoodY: Car_Y - (Car_BOTTOM - Car_HOOD) * scale,  // hood surface Y (lower than the roof)
    hp: Car_HP, max: Car_HP,
    wrecked: false
  }];
}

/* Draw the car (or its wreck) as a stage prop; tremble + cowling fire when weakened; the burning
   wreck keeps fire + black smoke ON the car (never on the ground). */
function drawCarProp(pr, t) {
  const scale = Car_DRAW / Car_IMG_W;
  const img = pr.wrecked ? Car_IMG.Car_side_destroyed : Car_IMG.Car_side;

  // weakened (< 45% hp, not yet wrecked): shed glass/metal bits (the low-health cue). NO shaking
  // before it blows — the car only jolts DURING the explosion (see boom-shake below).
  let shk = 0, weak = 0;
  if (!pr.wrecked && pr.hp < pr.max * 0.45) {
    weak = 1 - pr.hp / (pr.max * 0.45);
    if (typeof particles !== "undefined" && t >= (pr._shedT || 0)) {
      pr._shedT = t + 0.12 - weak * 0.05;
      particles.push({ x: pr.anchorX + (Math.random() - 0.5) * pr.w * 0.8, y: pr.baseY - Math.random() * pr.h * 0.6,
        vx: rand(-16, 16), vy: rand(-8, 20), r: rand(1, 2.2),
        col: ["#9aa2a8", "#c9d2d8", "#6d5233"][Math.floor(Math.random() * 3)], t: 0, life: rand(.35, .7) });
    }
  }

  // the car violently jolts DURING the explosion (first ~0.5s of the wreck), then settles
  if (pr.wrecked) {
    const boomAge = t - (pr._boomT || 0);
    if (boomAge >= 0 && boomAge < 0.5) shk = Math.sin(t * 70 + pr.anchorX) * 3.2 * (1 - boomAge / 0.5);
  }

  ctx.save();
  ctx.translate(pr.anchorX + shk, pr.baseY);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  // each sprite uses its OWN wheel-bottom/centre so both sit on the same ground line
  const acx = pr.wrecked ? Car_D_CX : Car_CX, abot = pr.wrecked ? Car_D_BOTTOM : Car_BOTTOM;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, -acx * scale, -abot * scale, Car_DRAW, Car_DRAW);
  } else {
    ctx.fillStyle = pr.wrecked ? "#5a2020" : "#b0201f"; ctx.fillRect(-pr.w / 2, -pr.h, pr.w, pr.h);
  }
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();

  // pre-explosion: once badly damaged (<45% hp) the COWLING/hood catches fire, growing as it weakens
  if (!pr.wrecked && weak > 0 && typeof drawFlameTuft === "function") {
    const hcx = pr.hoodX + pr.hoodW * 0.5 + shk, n = 3;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < n; k++) {
      const bx = hcx + (k / (n - 1) - 0.5) * pr.hoodW * 0.85;
      drawFlameTuft(bx, pr.hoodY, t, 1, 0.45 + 0.55 * weak, (k * 0.37 + 0.2) % 1, S(7 + 15 * weak));
    }
    ctx.restore();
    // a wisp of dark smoke off the burning cowling
    if (weak > 0.35) for (let i = 0; i < 2; i++) {
      const ph = (t * 0.5 + i * 0.5) % 1;
      ctx.save(); ctx.globalAlpha = 0.28 * weak * (1 - ph);
      ctx.fillStyle = i % 2 ? "#242424" : "#333333";
      ctx.beginPath(); ctx.arc(hcx + Math.sin(t + i * 2) * S(6) * ph, pr.hoodY - S(6) - ph * S(46), S(4) + ph * S(10), 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  // burning WRECK: fire + thick black smoke, all kept ON the car (drawWreckFire no longer grounds it)
  if (pr.wrecked && typeof drawWreckFire === "function") {
    drawWreckFire(pr.anchorX + shk, pr.baseY, t, 1.2, 1, Car_DRAW * 0.7);
  }
}

/* Detonate: explosion fx + blast (damage / knockback / BURN / knockdown) to nearby fighters. */
function carExplode(pr, owner) {
  const ex = pr.anchorX, ey = pr.baseY - pr.h * 0.5;
  pr._boomT = (typeof tGlobal !== "undefined") ? tGlobal : 0;   // stamp detonation time -> car jolt window
  if (typeof spawnCarBlast === "function") spawnCarBlast(ex, ey);
  else if (typeof spawnHitFx === "function") spawnHitFx(ex, ey, "#f28022", 20);
  if (typeof shake !== "undefined") shake = Math.max(shake, 1.5);
  if (typeof fighters !== "undefined") for (const f of fighters) {
    if (!f.alive) continue;
    if (Math.abs(f.x - ex) < S(Car_BOOM_RANGE)) {
      const dir = Math.sign(f.x - ex) || 1;
      f.takeDamage(Car_BOOM_DMG, Car_BOOM_KB, dir, { unblockable: true, col: "#ffd23f", fx: "#f28022" });
      f.burnDps = Car_BOOM_BURN_DPS; f.burn = Math.max(f.burn || 0, Car_BOOM_BURN_SEC);
      if (typeof statusFloat === "function") statusFloat(f, "BURN", "#f28022");
      // knocked down: cars.js updateCars turns _blastKd into the on-landing ground stun
      f.stun = Math.max(f.stun || 0, 0.5); f.koPose = Math.max(f.koPose || 0, 1.6); f._blastKd = true;
    }
  }
}

/* Per-frame: the burning WRECK is a hazard — any fighter standing on it or right beside it keeps
   catching BURN (throttled status popup). Called from the engine update loop. */
function updateCarProp(dt) {
  if (typeof props === "undefined" || typeof fighters === "undefined") return;
  const pr = props.find(p => p.kind === "car" && p.wrecked);
  if (!pr) return;
  const yTol = S(10);   // "standing on it" tolerance: feet within this of the roof/hood surface
  for (const f of fighters) {
    if (f._carPropBurnT > 0) f._carPropBurnT -= dt;
    // burn ONLY when standing ON TOP of the wreck — on the roof span or the hood span, not beside it
    const onRoof = f.x > pr.roofX - S(4) && f.x < pr.roofX + pr.roofW + S(4) && Math.abs(f.y - pr.topY) < yTol;
    const onHood = f.x > pr.hoodX - S(4) && f.x < pr.hoodX + pr.hoodW + S(4) && Math.abs(f.y - pr.hoodY) < yTol;
    if (f.alive && (onRoof || onHood)) {
      f.burnDps = Math.max(f.burnDps || 0, Car_FIRE_BURN_DPS);
      f.burn = Math.max(f.burn || 0, Car_FIRE_BURN_SEC);
      if ((f._carPropBurnT || 0) <= 0) { if (typeof statusFloat === "function") statusFloat(f, "BURN", "#f28022"); f._carPropBurnT = 1.3; }
    }
  }
}
