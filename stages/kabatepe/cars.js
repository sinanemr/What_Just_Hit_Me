/**
 * What Just Hit Me — parked TRAFFIC + car-explosion event on the left road of Kabatepe.
 * Plain <script>, loaded AFTER engine.js (uses GROUND, ctx, S, fighters, projectiles,
 * takeDamage, statusFloat, ringFx, spawnHitFx, particles, rand, shake, roundOver, tGlobal).
 * The parked jam is a fixed perspective table (host and guest draw the same cars); the
 * explosion event is host-authoritative and synced to the guest (carsSerialize/carsApply).
 *
 * The left of the map is the long asphalt lot/road that recedes up toward the pier.
 * We park a row of 3 cars next to each other near the front, then scatter more cars
 * further up the road (smaller = further away) so it reads like a traffic jam.
 *
 * Cars are drawn BEHIND the fighters, so a fighter walking left passes in FRONT of them.
 * Positions/sizes are first-pass — tune CARS below (x,y = world feet anchor; s = scale).
 */
"use strict";

// 3 car models, each with a clean + a wrecked/rusty version (rear-view sprites).
const CAR_DIR = "assets/stages/kabatepe/cars/";
const CAR_KEYS = ["car1", "car1_wreck", "car2", "car2_wreck", "car3", "car3_wreck"];
const CAR_IMG = {};
CAR_KEYS.forEach(k => { const im = new Image(); im.src = CAR_DIR + k + ".png"; CAR_IMG[k] = im; });

const CAR_BASE = 96;      // base draw size (world px) at scale 1.0 — TUNE
const CAR_ANCHOR = 0.80;  // fraction of the sprite height at which the wheels sit — raise if cars float, lower if they sink
// Per-model draw-size fix: the white hatchback (model 1) sits smaller inside its sprite than
// the sedans, so scale it up to read the same size as the cars next to it. TUNE per model.
const MODEL_SCALE = { 1: 1.2, 2: 1, 3: 1 };

// The nearest cars sit on the players' ground line and form the LEFT map boundary:
// fighters cannot move left of this x (enforced in engine.js + online prediction).
const CARS_WALL_X = 290;

// The traffic jam is generated ALONG the road's perspective so every car sits on
// the same receding surface and shrinks correctly toward the horizon. Tune ROAD:
//   horizonY   = world y of the vanishing point (the road/sea horizon line)
//   vanishX    = world x the road converges toward at the horizon
//   nearY      = world y of the closest (biggest) car row
//   nearScale  = scale of a car sitting at nearY (multiplied by CAR_BASE)
//   nearCenterX= world x of the road centre at the near row
//   laneHalf   = half the gap between the two lanes at the near row
//   twoLaneRows= how many of the closest rows show both lanes (further rows are single)
// A car's scale is proportional to its height below the horizon (true perspective),
// and its x slides toward vanishX as it recedes, so lanes converge to a point.
const ROAD = {
  horizonY: 168, vanishX: 300, nearY: 230, nearScale: 0.95,
  nearCenterX: 162, laneHalf: 82
};
// wheel-line y for each row, foreground -> horizon (spacing tightens with perspective).
// Tuned to the ROAD the user marked in red: a wedge that is WIDE at the near bottom-left and
// converges up toward the guard booth. The FIRST row sits on GROUND (230) as the left wall,
// spread wide (nearCenterX +/- laneHalf) across the near end; the lanes then converge toward
// the booth apex (vanishX/horizonY) as they recede, staying between the red lines.
const CAR_ROW_Y = [230, 217, 206, 197, 189, 182, 176, 171];
const LANES = [-1, 0, 1];   // three parallel lanes (left/centre/right); each gets a car at EVERY row

// Deterministic pseudo-random in [0,1) from an index — gives the car models a random-looking
// spread while keeping the layout IDENTICAL on host and guest (the car table must match online).
function carHash(n) { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = (h * 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }
// the 6 orderings of the 3 models; each row picks one so it shows all three car types in a
// random arrangement — varied per row, never a row of identical cars.
const CAR_PERMS = [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]];

function buildTraffic() {
  const list = [];
  for (let i = 0; i < CAR_ROW_Y.length; i++) {
    const y = CAR_ROW_Y[i];
    const f = (y - ROAD.horizonY) / (ROAD.nearY - ROAD.horizonY);   // 1 near, ->0 at horizon
    const s = ROAD.nearScale * f;
    const centerX = ROAD.vanishX + (ROAD.nearCenterX - ROAD.vanishX) * f;
    const lane = ROAD.laneHalf * f;
    const perm = CAR_PERMS[Math.floor(carHash(i + 1) * CAR_PERMS.length)];   // this row's model order
    // Same facing (a queued jam), no flipping; each row shows the 3 models in a random order.
    let j = 0;
    for (const side of LANES) {
      list.push({ x: centerX + side * lane, y, s, t: perm[j % 3], w: false, flip: false });
      j++;
    }
  }
  return list;
}
// Each car: { x, y, s, t, w, flip }; drawn far-to-near so nearer cars overlap the rest.
const CARS = buildTraffic();
// NOTE: the two hand-placed left "edge" cars and the front-left nudge were removed — they
// sat at the near ground line to the LEFT of the wedge and read as a separate horizontal
// cluster. The front row is now purely the perspective wedge base, so its left edge lines
// up on the same receding diagonal as every other row.
// The front-left white car (model 1) sits a touch CLOSER to the camera and slightly RIGHT.
CARS[0].x += 16; CARS[0].y += 12; CARS[0].s *= 1.06;

/* =============== CAR EXPLOSION EVENT ===============
 * Hit the jammed cars 3x and the WHOLE front row (closest to the screen) detonates: each
 * car's sprite swaps to its wreck, a big animated fireball + lingering fire play, nearby
 * fighters are knocked away and set on fire (BURN 4s), and afterwards anyone who lingers
 * by a burning wreck keeps catching BURN (a smaller radius than the blast). */
const CARS_HIT_MAX = 3;       // hits to detonate
const CARS_HIT_CD = 0.35;     // per-fighter hit throttle (one swing = one hit)
const BOOM_DMG = 40, BOOM_KB = 480, BOOM_RANGE = 180;    // explosion damage / knockback / radius
const BOOM_BURN_DPS = 10, BOOM_BURN_SEC = 4;             // burn applied by the blast
const FIRE_RANGE = 65, FIRE_BURN_DPS = 8, FIRE_BURN_SEC = 2;   // lingering wreck fire (smaller than the blast)
const BOOM_DUR = 0.62;        // seconds the animated fireball plays before settling into steady fire
// The whole front row detonates together: the 3 near lanes (row 0, the closest cars).
const BOOM_CARS = CARS.slice(0, LANES.length);
const BOOM_CAR = CARS[2];     // rightmost front car (closest a player can reach) — used for the burn zone
let carHits = 0;
let carFire = null;           // { t } once it has blown up (persistent burning wreck), else null

/* World-space draw (called from renderGame, just after the backdrop). */
function drawCars() {
  // far cars first so near cars overlap them
  const order = CARS.slice().sort((a, b) => a.y - b.y);
  for (const c of order) {
    const key = "car" + c.t + (c.w ? "_wreck" : "");
    const img = CAR_IMG[key];
    const size = CAR_BASE * c.s * (MODEL_SCALE[c.t] || 1);
    ctx.save();
    ctx.translate(Math.round(c.x), Math.round(c.y - size * CAR_ANCHOR));
    if (c.flip) { ctx.scale(-1, 1); }
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -size / 2, 0, size, size);
    } else {
      // placeholder until the PNGs are in place
      ctx.fillStyle = "#3a3a44";
      ctx.fillRect(-size * 0.28, size * 0.45, size * 0.56, size * 0.3);
    }
    ctx.restore();
  }

  // explosion + lingering fire on the wrecked front row (behind fighters; embers are global)
  if (carFire) {
    const age = carFire.t / BOOM_DUR;                         // 0..1 during the fireball
    for (const c of BOOM_CARS) {
      const cx = c.x, cScale = c.s || 0.9, groundY = c.y || GROUND;
      const cSize = CAR_BASE * cScale * (MODEL_SCALE[c.t] || 1);
      if (age < 1) drawFireball(cx, groundY - S(20), age, cScale);
      const fireA = Math.min(1, Math.max(0, (carFire.t - BOOM_DUR * 0.4) / 0.4));  // fade in as the fireball fades
      if (fireA > 0) drawWreckFire(cx, groundY, tGlobal, cScale, fireA, cSize);
    }
    ctx.globalAlpha = 1;
  }
}

/* A growing, fading fireball with billowing lobes (radial gradients). age 0..1. */
function drawFireball(cx, cy, age, scale) {
  const R = S(72) * scale * (0.35 + 0.65 * Math.sqrt(age));
  const fade = age < 0.5 ? 1 : (1 - (age - 0.5) / 0.5);
  const y = cy - S(20) * scale * age;                          // lifts as it grows
  ctx.save();
  let g = ctx.createRadialGradient(cx, y, 0, cx, y, R);
  g.addColorStop(0, "rgba(255,255,238," + (0.95 * fade) + ")");
  g.addColorStop(0.35, "rgba(255,214,74," + (0.9 * fade) + ")");
  g.addColorStop(0.65, "rgba(242,128,34," + (0.72 * fade) + ")");
  g.addColorStop(1, "rgba(150,30,15,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, y, R, 0, 7); ctx.fill();
  for (let i = 0; i < 5; i++) {                                // rolling lobes
    const a = i / 5 * 6.283 + age * 2.2;
    const lr = R * (0.5 - 0.05 * i);
    const lx = cx + Math.cos(a) * R * 0.52, ly = y + Math.sin(a) * R * 0.42 - R * 0.12;
    let g2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    g2.addColorStop(0, "rgba(255,238,150," + (0.8 * fade) + ")");
    g2.addColorStop(0.6, "rgba(242,128,34," + (0.5 * fade) + ")");
    g2.addColorStop(1, "rgba(200,60,20,0)");
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* A living fire on a burning wreck: pulsing heat glow, an ember bed, several swaying
   flame columns drawn additively (so overlaps glow), detached licks, rising embers, and
   a drifting smoke column. Driven by tGlobal so it moves smoothly on host and guest. */
function drawWreckFire(cx, groundY, t, scale, alpha, size) {
  const baseY = groundY - S(3);
  size = size || S(90);
  const carHalfW = size * 0.30;              // car body half-width
  const bodyH = size * 0.55;                 // how high fire can start on the body (up to the roof)
  const halfW = carHalfW + S(12);            // total fire spread (car + a little ground beyond)
  const hsh = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };  // stable pseudo-random 0..1
  ctx.save();

  // pulsing heat glow at the base
  const pulse = 0.85 + 0.15 * Math.sin(t * 8);
  const gw = halfW * 1.7 * pulse;
  let hg = ctx.createRadialGradient(cx, baseY - S(6), 0, cx, baseY - S(6), gw);
  hg.addColorStop(0, "rgba(255,160,50," + (0.5 * alpha) + ")");
  hg.addColorStop(0.5, "rgba(230,90,20," + (0.26 * alpha) + ")");
  hg.addColorStop(1, "rgba(200,60,10,0)");
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, baseY - S(6), gw, 0, 7); ctx.fill();

  // flames — additive blending gives the glowing, translucent look real fire has
  ctx.globalCompositeOperation = "lighter";
  // fire ON TOP of the car: flame tufts scattered at RANDOM spots over the body and roof
  for (let k = 0; k < 9; k++) {
    const bx = cx + (hsh(k) * 2 - 1) * carHalfW * 0.95;
    const by = groundY - S(5) - hsh(k + 40) * bodyH;                  // random height, up onto the roof
    drawFlameTuft(bx, by, t, scale, alpha, hsh(k + 70), S(6 + 12 * hsh(k + 90)) * scale);
  }
  // (no fire on the ground — the fire stays ON the car)
  // embers drifting up from random spots
  for (let i = 0; i < 10; i++) {
    const ph = (t * 1.3 + hsh(i + 300)) % 1;
    const ex2 = cx + (hsh(i + 320) * 2 - 1) * (carHalfW + S(6));
    const ey2 = groundY - S(3) - ph * (bodyH + S(22));
    ctx.fillStyle = (i % 2 ? "rgba(255,210,80," : "rgba(255,150,40,") + (alpha * (1 - ph)) + ")";
    const es = S(1.6) * (1 - ph * 0.5);
    ctx.fillRect(ex2, ey2, es, es);
  }
  ctx.globalCompositeOperation = "source-over";

  // glowing coals — kept ON the car's own footprint (not spread out over the ground)
  for (let i = 0; i < 8; i++) {
    const bx = cx + (i / 7 - 0.5) * 2 * carHalfW * 0.9;
    const gl = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
    ctx.globalAlpha = alpha * (0.32 + 0.4 * gl);
    ctx.fillStyle = gl > 0.5 ? "#ffb038" : "#e2551a";
    ctx.fillRect(bx, baseY - S(2), S(3), S(2));
  }
  ctx.globalAlpha = 1;

  // thick BLACK smoke boiling up off the burning wreck (something is clearly on fire)
  for (let i = 0; i < 9; i++) {
    const ph = (t * 0.38 + i * 0.19) % 1;
    const sx = cx + (hsh(i + 400) * 2 - 1) * carHalfW * 0.8 + Math.sin(t * 1.1 + i * 2) * S(10) * ph;
    const sy = groundY - bodyH - ph * S(86);
    ctx.globalAlpha = alpha * 0.42 * (1 - ph * 0.85);
    ctx.fillStyle = ph < 0.45 ? "#171717" : (i % 2 ? "#242424" : "#333333");   // darkest at the base
    ctx.beginPath(); ctx.arc(sx, sy, S(5) + ph * S(15), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* A single small flickering flame tuft rising from (bx, by) up to height hgt. Used to
   scatter fire over a burning car's body/roof and along the ground. seed 0..1 varies it. */
function drawFlameTuft(bx, by, t, scale, alpha, seed, hgt) {
  const segs = 6, ph = seed * 6.283;
  for (let s = 0; s < segs; s++) {
    const f = s / (segs - 1);
    const fx = bx + Math.sin(t * (5 + seed * 5) + f * 4 + ph) * S(3.5) * scale * f;
    const fy = by - f * hgt;
    const flick = 0.7 + 0.3 * Math.sin(t * 18 + s + ph);
    const rr = S(4.2) * scale * (1 - 0.72 * f) * flick;
    if (rr < 0.4) continue;
    let col;
    if (f < 0.22) col = "rgba(255,248,210," + (0.5 * alpha) + ")";
    else if (f < 0.5) col = "rgba(255,214,90," + (0.46 * alpha) + ")";
    else if (f < 0.76) col = "rgba(242,128,34," + (0.36 * alpha) + ")";
    else col = "rgba(200,55,20," + (0.26 * alpha) + ")";
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(fx, fy, rr, 0, 7); ctx.fill();
  }
}

/* Reset the event each round (restore the clean sprites). */
function resetCars() {
  carHits = 0; carFire = null;
  for (const c of BOOM_CARS) c.w = false;
}

/* One hit on the jammed cars; the 3rd detonates the front car. */
function hitCars(attacker) {
  if (carFire) return;
  carHits++;
  if (typeof spawnHitFx === "function") spawnHitFx(BOOM_CAR.x + S(14), GROUND - S(28), "#cfcfcf", 6);
  if (typeof shake !== "undefined") shake = Math.max(shake, 0.25);
  if (carHits >= CARS_HIT_MAX) explodeCar();
}

/* Detonate the whole front row: wreck sprites, big blast fx, damage/knockback/BURN. */
function explodeCar() {
  carFire = { t: 0 };
  if (typeof shake !== "undefined") shake = Math.max(shake, 1.5);
  for (const c of BOOM_CARS) { c.w = true; spawnCarBlast(c.x, (c.y || GROUND) - S(30)); }
  if (typeof fighters !== "undefined") for (const f of fighters) {   // blast: knock away + damage + BURN
    if (!f.alive) continue;
    let near = Infinity, nx = BOOM_CAR.x;
    for (const c of BOOM_CARS) { const d = Math.abs(f.x - c.x); if (d < near) { near = d; nx = c.x; } }
    if (near < S(BOOM_RANGE)) {
      const dir = Math.sign(f.x - nx) || 1;                          // away from the nearest wreck
      f.takeDamage(BOOM_DMG, BOOM_KB, dir, { unblockable: true, col: "#ffd23f", fx: "#f28022" });
      f.burnDps = BOOM_BURN_DPS; f.burn = Math.max(f.burn || 0, BOOM_BURN_SEC);
      if (typeof statusFloat === "function") statusFloat(f, "BURN", "#f28022");
      // knocked down: KO/lying pose while flung, then pinned + stunned on the ground (see updateCars)
      f.stun = Math.max(f.stun || 0, 0.5); f.koPose = Math.max(f.koPose || 0, 1.6); f._blastKd = true;
    }
  }
}

/* One car's worth of blast particles: flash core, fireball embers, sparks, debris, smoke.
   Drawn by the global fx layer (in front of fighters), so this is the flashy up-front burst. */
function spawnCarBlast(ex, ey) {
  if (typeof ringFx === "function") { ringFx(ex, ey, "#ffffff", S(30)); ringFx(ex, ey, "#ffd23f", S(70)); ringFx(ex, ey, "#f28022", S(112)); }
  if (typeof particles === "undefined") return;
  for (let i = 0; i < 4; i++) particles.push({ x: ex, y: ey, vx: rand(-30, 30), vy: rand(-30, 10), r: rand(6, 10), col: i % 2 ? "#ffffff" : "#fff2c8", t: 0, life: rand(.1, .2) });
  for (let i = 0; i < 20; i++) { const a = Math.random() * 6.283, sp = rand(80, 330); particles.push({ x: ex, y: ey, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, r: rand(2, 5), col: ["#fff2c8", "#ffd23f", "#f7971e", "#f28022", "#d9531e"][i % 5], t: 0, life: rand(.35, .8) }); }
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283, sp = rand(240, 480); particles.push({ x: ex, y: ey, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, r: rand(1, 2), col: "#ffe680", t: 0, life: rand(.2, .4) }); }
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + rand(-1.2, 1.2), sp = rand(140, 320); particles.push({ x: ex, y: ey, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, r: rand(2, 4), col: ["#2c2c2c", "#4a4a4a", "#6a5a4a"][i % 3], t: 0, life: rand(.7, 1.2) }); }
  for (let i = 0; i < 8; i++) { const a = Math.random() * 6.283, sp = rand(15, 80); particles.push({ x: ex + rand(-10, 10), y: ey - S(8), vx: Math.cos(a) * sp * 0.4, vy: -Math.abs(Math.sin(a) * sp) - 30, r: rand(4, 8), col: ["#3a3a3a", "#555555", "#6e6e6e"][i % 3], t: 0, life: rand(.8, 1.5) }); }
}

/* Authoritative per-frame update (host + local; the guest gets state from snapshots). */
function updateCars(dt) {
  const over = (typeof roundOver !== "undefined" && roundOver);
  // blast knockdown: once a flung fighter lands, pin it down and stun for ~1s on the ground
  if (typeof fighters !== "undefined") for (const f of fighters) {
    if (f._blastKd && f.alive && f.onGround) {
      f._blastKd = false; f.koPose = 1.0;
      f.stun = Math.max(f.stun || 0, 1.0);   /* stun WITHOUT zeroing vx (applyStun would) so he keeps sliding backward, then friction stops him */
    }
  }
  // hit detection: a fighter attacking LEFT into the wall / a damaging projectile reaching it
  if (!carFire && !over && typeof fighters !== "undefined") {
    for (const f of fighters) {
      // ONE basic attack / ONE skill = ONE hit (multi-hit moves count once) via the attack-instance id
      if (f.alive && (f.state === "attack" || f.state === "special") && f._carHitSeq !== (f.atkSeq || 0)
          && f.facing < 0 && (f.x - CARS_WALL_X) < S(60) && (f.x - CARS_WALL_X) > -20) {
        hitCars(f); f._carHitSeq = (f.atkSeq || 0);
      }
    }
    if (typeof projectiles !== "undefined") {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if ((p.dmg || p.power || 0) > 0 && Math.abs(p.x - CARS_WALL_X) < S(30) && p.y > GROUND - S(80)) {
          hitCars(p.owner || null); projectiles.splice(i, 1); break;
        }
      }
    }
  }
  // lingering fire: anyone close to the burning wreck keeps catching BURN
  if (carFire) {
    carFire.t += dt;
    if (!over && typeof fighters !== "undefined") for (const f of fighters) {
      if (f._carBurnT > 0) f._carBurnT -= dt;
      if (f.alive && Math.abs(f.x - BOOM_CAR.x) < S(FIRE_RANGE)) {
        f.burnDps = Math.max(f.burnDps || 0, FIRE_BURN_DPS); f.burn = Math.max(f.burn || 0, FIRE_BURN_SEC);
        if ((f._carBurnT || 0) <= 0) { if (typeof statusFloat === "function") statusFloat(f, "BURN", "#f28022"); f._carBurnT = 1.3; }
      }
    }
  }
}

/* Online sync (host -> guest). */
function carsSerialize() { return { hits: carHits, fire: carFire ? carFire.t : -1 }; }
function carsApply(s) {
  if (!s) return;
  carHits = s.hits;
  if (s.fire >= 0) { if (!carFire) carFire = { t: 0 }; carFire.t = s.fire; for (const c of BOOM_CARS) c.w = true; }
  else { carFire = null; for (const c of BOOM_CARS) c.w = false; }
}
