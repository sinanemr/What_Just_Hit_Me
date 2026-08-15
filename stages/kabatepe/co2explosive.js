/**
 * What Just Hit Me — explosive CO2 CYLINDERS (CO2_Tank_01_(explossive)) standing at the PLAYERS'
 * level on the Kabatepe stage. Plain <script>, loaded AFTER engine.js AND cars.js (reuses
 * spawnCarBlast + drawFlameTuft). Scattered around the arena as breakable/explosive hazards.
 * (File is co2explosive.js — NOT co2tank.js, which would collide with CO2Tank.js on Windows.)
 *
 * Registered as destructible props (kind:"co2tank") via buildCO2TankProps(); each takes 3 HITS to
 * blow (one basic attack OR one skill = one hit — the engine's damageProp handles that dedup):
 *   3 hp (fresh)          -> normal
 *   2 hp (after 1 hit)    -> hisses COMPRESSED AIR from the valve
 *   1 hp (after 2 hits)   -> jets FIRE from the valve
 *   0 hp (after 3 hits)   -> EXPLODES (smaller reach/damage than the car) + BURN + knockdown
 * The blast knocks fighters down exactly like the car (reuses _blastKd -> updateCars landing loop).
 */
"use strict";

const CO2X_DIR = "assets/stages/kabatepe/Static/";
const CO2X_IMG = new Image();
CO2X_IMG.src = CO2X_DIR + "CO2_Tank_01_(explossive).png";

const CO2X_IMG_W = 1080;
// measured content: centre x, base bottom, valve TOP (burst origin), content width.
const CO2X = { cx: 551, bottom: 1014, top: 444, cw: 161 };
const CO2X_DRAW = 67;   // canvas draw size (world px) -> tank ~48 world px tall at the play plane

// where they stand (world x, at GROUND). Spread across the arena, clear of clutter. TUNE.
const CO2X_SPOTS = [360, 840, 1300];

// --- explosion: a little less than the car (less range + damage), still BURNs + knocks down ---
const CO2X_BOOM_DMG = 16, CO2X_BOOM_KB = 300, CO2X_BOOM_RANGE = 120;
const CO2X_BOOM_BURN_DPS = 8, CO2X_BOOM_BURN_SEC = 3;

function buildCO2TankProps() {
  const scale = CO2X_DRAW / CO2X_IMG_W;
  const w = CO2X.cw * scale, h = (CO2X.bottom - CO2X.top) * scale;
  const g = (typeof GROUND !== "undefined" ? GROUND : 230);
  return CO2X_SPOTS.map(x => ({
    kind: "co2tank",
    x: x - w / 2, w, h,
    baseY: g,
    anchorX: x,
    topBurstY: g - h,   // valve top (world y) — burst origin
    hp: 3, max: 3
  }));
}

/* compressed-air hiss from the valve (2 hp): translucent white puffs + sharp jet lines. */
function drawAirJet(cx, topY, t) {
  const hsh = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const ph = (t * 1.7 + i * 0.13) % 1;
    const yy = topY - S(3) - ph * S(30);
    const xx = cx + Math.sin(t * 9 + i) * S(2) * ph + (hsh(i) * 2 - 1) * S(1.6);
    ctx.globalAlpha = 0.5 * (1 - ph);
    ctx.fillStyle = i % 2 ? "#eaf4f9" : "#c7d6df";
    ctx.beginPath(); ctx.arc(xx, yy, S(1.1) + ph * S(3.6), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 0.6; ctx.strokeStyle = "#f4fbff"; ctx.lineWidth = Math.max(1, S(0.7));
  for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + k * S(1.4), topY - S(2)); ctx.lineTo(cx + k * S(2.6), topY - S(11)); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.restore();
}

/* fire jet from the valve (1 hp): flame tufts shooting up + a wisp of smoke. */
function drawFireJet(cx, topY, t) {
  ctx.save();
  if (typeof drawFlameTuft === "function") {
    ctx.globalCompositeOperation = "lighter";
    drawFlameTuft(cx, topY - S(1), t, 1, 0.95, 0.2, S(22));
    drawFlameTuft(cx - S(2), topY, t, 1, 0.7, 0.6, S(14));
    drawFlameTuft(cx + S(2), topY, t, 1, 0.7, 0.9, S(14));
    ctx.globalCompositeOperation = "source-over";
  } else { ctx.fillStyle = "#f28022"; ctx.fillRect(cx - 2, topY - 16, 4, 16); }
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.6 + i * 0.33) % 1;
    ctx.globalAlpha = 0.24 * (1 - ph);
    ctx.fillStyle = i % 2 ? "#242424" : "#333333";
    ctx.beginPath(); ctx.arc(cx + Math.sin(t + i * 2) * S(4) * ph, topY - S(20) - ph * S(34), S(3) + ph * S(8), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

/* Draw the cylinder + its current-stage venting fx. */
function drawCO2TankProp(pr, t) {
  const scale = CO2X_DRAW / CO2X_IMG_W;
  ctx.save();
  ctx.translate(pr.anchorX, pr.baseY);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  if (CO2X_IMG.complete && CO2X_IMG.naturalWidth > 0) {
    ctx.drawImage(CO2X_IMG, -CO2X.cx * scale, -CO2X.bottom * scale, CO2X_IMG_W * scale, CO2X_IMG_W * scale);
  } else {
    ctx.fillStyle = "#8fd43a"; ctx.fillRect(-pr.w / 2, -pr.h, pr.w, pr.h);
  }
  ctx.imageSmoothingEnabled = sm;
  ctx.restore();
  if (pr.hp === 2) drawAirJet(pr.anchorX, pr.topBurstY, t);
  else if (pr.hp === 1) drawFireJet(pr.anchorX, pr.topBurstY, t);
}

/* Detonate — smaller blast than the car; BURN + knockdown, same reaction as other explosions. */
function co2TankExplode(pr, owner) {
  const ex = pr.anchorX, ey = pr.baseY - pr.h * 0.5;
  if (typeof spawnCarBlast === "function") spawnCarBlast(ex, ey);
  else if (typeof spawnHitFx === "function") spawnHitFx(ex, ey, "#f28022", 16);
  if (typeof shake !== "undefined") shake = Math.max(shake, 1.1);
  if (typeof fighters !== "undefined") for (const f of fighters) {
    if (!f.alive) continue;
    if (Math.abs(f.x - ex) < S(CO2X_BOOM_RANGE)) {
      const dir = Math.sign(f.x - ex) || 1;
      f.takeDamage(CO2X_BOOM_DMG, CO2X_BOOM_KB, dir, { unblockable: true, col: "#d6f5a0", fx: "#f28022" });
      f.burnDps = CO2X_BOOM_BURN_DPS; f.burn = Math.max(f.burn || 0, CO2X_BOOM_BURN_SEC);
      if (typeof statusFloat === "function") statusFloat(f, "BURN", "#f28022");
      f.stun = Math.max(f.stun || 0, 0.5); f.koPose = Math.max(f.koPose || 0, 1.4); f._blastKd = true;
    }
  }
}
