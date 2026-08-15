/**
 * What Just Hit Me — roaming DOG hazard for the Kabatepe stage.
 * Plain <script>, loaded AFTER engine.js (uses its globals: fighters, GROUND, WALL_L/R,
 * S, ctx, statusFloat, spawnHitFx, ringFx, roundOver, projectiles, tGlobal).
 *
 * Mechanic:
 *  - Every DOG_SPAWN_INTERVAL seconds a dog runs in and chases the NEAREST fighter
 *    (player or CPU — whoever is closest) and bites, applying BLEED.
 *  - The dog has an HP bar; basic attacks and damaging projectiles hurt it.
 *  - Whoever lands the KILLING hit gets a DOG_BUFF_SEC buff: their BASIC ATTACK deals
 *    bonus POISON damage and applies POISON to whoever it hits.
 *
 * NOTE: sizes/timings below are first-pass and meant to be tuned once the sprites are
 * in and it's been seen in-game.
 */
"use strict";

const DOG_SPAWN_INTERVAL = 20;   // seconds between dog appearances
const DOG_MAXHP = 70;            // basic-attack hits to kill (power ~8-14 => ~5-9 hits)
const DOG_SPEED = 130;           // world px/s chase speed
const DOG_BITE_RANGE = 46;       // sprite-px; scaled by S()
const DOG_BITE_CD = 1.6;         // seconds between bites
const DOG_RETREAT_SEC = 0.7;     // after a bite, dart a short random distance away, then chase again
const DOG_BITE_DMG = 6;          // direct bite damage (bleed is the main effect)
const DOG_BLEED_DPS = 10, DOG_BLEED_SEC = 3;
const DOG_BUFF_SEC = 10;         // kill-reward buff duration
const DOG_BUFF_POISON_DPS = 10, DOG_BUFF_POISON_SEC = 4, DOG_BUFF_BONUS = 6; // buffed basic-attack poison
const DOG_SIZE = 67;            // on-screen size of the full sprite (world px) — TUNE if too big/small
const DOG_FOOT = 5;             // sprite bottom sits this far below GROUND — TUNE for feet alignment
const DOG_HITBOX = 26;           // extra melee reach when hitting the dog (world px) — RAISE if hard to hit
const DOG_BODY = 24;             // solid-body half-width: grounded fighters can't pass within this (jump over)

// --- sprites: place the 5 PNGs in this folder (see chat for filenames) ---
const DOG_DIR = "assets/stages/kabatepe/dog/";
const DOG_IMG = {};
["idle", "run1", "run2", "attack", "hit"].forEach(k => { const im = new Image(); im.src = DOG_DIR + k + ".png"; DOG_IMG[k] = im; });
// base facing of each source sprite (idle/attack/hit face LEFT; run frames face RIGHT)
const DOG_BASE_FACE = { idle: -1, attack: -1, hit: -1, run1: 1, run2: 1 };

let dog = null;                  // the live dog entity, or null
let dogSpawnT = 0;               // counts up toward DOG_SPAWN_INTERVAL

/* Called at the start of every round (and when leaving a match). */
function resetDog() {
  dog = null; dogSpawnT = 0;
  if (typeof fighters !== "undefined") for (const f of fighters) f.dogBuff = 0;
}

function spawnDog() {
  const mid = fighters.length >= 2 ? (fighters[0].x + fighters[1].x) / 2 : (WALL_L + WALL_R) / 2;
  const fromLeft = mid > (WALL_L + WALL_R) / 2;   // enter from the side farther from the fight
  dog = {
    x: fromLeft ? WALL_L - 30 : WALL_R + 30, y: GROUND,
    facing: fromLeft ? 1 : -1, state: "run", t: 0,
    hp: DOG_MAXHP, maxhp: DOG_MAXHP, biteCd: 0, hitFlash: 0, dead: 0, bit: false, runAttack: false
  };
}

// a fighter up on a car/crate/platform (or airborne) is out of the ground-level dog's reach
function dogCanReach(f) { return !!f && f.alive && f.y >= GROUND - S(8); }

function nearestFighter(x, groundedOnly) {
  let best = null, bd = 1e9;
  for (const f of fighters) {
    if (!f.alive) continue;
    if (groundedOnly && f.y < GROUND - S(8)) continue;   // skip players standing on an obstacle
    const d = Math.abs(f.x - x); if (d < bd) { bd = d; best = f; }
  }
  return best;
}

/* Authoritative per-frame update (runs locally + on the online host; the guest gets
   the dog from snapshots and never calls this). */
function updateDog(dt) {
  // kill-reward buff ticks whether or not a dog is present
  if (typeof fighters !== "undefined") for (const f of fighters) if (f.dogBuff > 0) f.dogBuff -= dt;
  if (typeof roundOver !== "undefined" && roundOver) return;

  if (!dog) {
    dogSpawnT += dt;
    if (dogSpawnT >= DOG_SPAWN_INTERVAL) { dogSpawnT = 0; spawnDog(); }
    return;
  }

  dog.t += dt;
  if (dog.hitFlash > 0) dog.hitFlash -= dt;
  if (dog.biteCd > 0) dog.biteCd -= dt;

  if (dog.state === "dead") { dog.dead += dt; if (dog.dead > 0.6) { dog = null; dogSpawnT = 0; } return; }

  // prefer a reachable (grounded) player; if the nearest one hops onto an obstacle, chase the OTHER
  const target = nearestFighter(dog.x, true) || nearestFighter(dog.x);
  if (!target) { dog = null; return; }
  const canReach = dogCanReach(target);
  const dx = target.x - dog.x, adx = Math.abs(dx);
  dog.facing = dx >= 0 ? 1 : -1;

  if (dog.state === "attack") {
    const windup = dog.runAttack ? 0.05 : 0.2;         // run-bite skips the idle windup
    if (dog.runAttack && dog.t < 0.18) { dog.vx = dog.facing * DOG_SPEED * 0.5; dog.x += dog.vx * dt; }  // short lunge
    else dog.vx = 0;
    if (!dog.bit && dog.t >= windup) {
      dog.bit = true;
      if (canReach && Math.abs(target.x - dog.x) < S(DOG_BITE_RANGE) + 10 && target.alive) {
        target.takeDamage(DOG_BITE_DMG, 0, dog.facing, { unblockable: true, dot: true, col: "#ff5e6e", fx: "#ff5e6e" });
        target.bleedDps = DOG_BLEED_DPS; target.bleed = Math.max(target.bleed || 0, DOG_BLEED_SEC);
        statusFloat(target, "BLEED", "#ff5e6e");
        if (typeof ringFx === "function") ringFx(target.x, target.centerY, "#e2384a", 40);
      }
    }
    if (dog.t >= 0.45) {
      dog.state = "run"; dog.t = 0; dog.biteCd = DOG_BITE_CD; dog.bit = false; dog.runAttack = false;
      dog.retreatT = DOG_RETREAT_SEC; dog.retreatDir = (dx >= 0) ? -1 : 1;   // dart AWAY from the player after biting
    }
    return;
  }

  if (dog.retreatT > 0) {                        // brief post-bite retreat, then it turns back to chase
    dog.retreatT -= dt;
    dog.state = "run"; dog.facing = dog.retreatDir;
    dog.vx = dog.retreatDir * DOG_SPEED * 0.85; dog.x += dog.vx * dt;
  } else if (adx > S(DOG_BITE_RANGE) - 4) {      // chase
    dog.state = "run"; dog.vx = dog.facing * DOG_SPEED; dog.x += dog.vx * dt;
  } else {                                       // in range: bite (if ready & reachable) or wait
    dog.vx = 0;
    if (canReach && dog.biteCd <= 0) { dog.runAttack = (dog.state === "run"); dog.state = "attack"; dog.t = 0; dog.bit = false; }
    else dog.state = "idle";
  }
  dog.x = Math.max(WALL_L - 40, Math.min(WALL_R + 40, dog.x));
  dog.y = GROUND;

  // SOLID BODY — grounded fighters can't walk through the dog; jump to pass over it
  if (dog.state !== "dead") {
    for (const f of fighters) {
      if (!f.alive || !f.onGround || f.y < GROUND - S(8)) continue;   // airborne OR on an obstacle: clear the dog
      const d = f.x - dog.x;
      if (Math.abs(d) < DOG_BODY) {
        f.x = dog.x + DOG_BODY * (d >= 0 ? 1 : -1);
        if ((d >= 0 && f.vx < 0) || (d < 0 && f.vx > 0)) f.vx = 0;  // stop walking into it
        f.x = Math.max(WALL_L, Math.min(WALL_R, f.x));
      }
    }
  }

  // damaging projectiles that overlap the dog hurt it (lets ranged basics kill it too)
  if (typeof projectiles !== "undefined") {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; const pd = p.dmg || p.power || 0;
      if (pd > 0 && Math.abs(p.x - dog.x) < S(30) && p.y > GROUND - S(46) && p.y < GROUND + 8) {
        dogTakeDamage(pd, p.owner || null); projectiles.splice(i, 1); break;
      }
    }
  }

  // MELEE hurt-zone: any fighter mid-attack or mid-skill, close and facing the dog,
  // damages it (throttled per fighter). Covers the basic attack AND all melee skills.
  for (const f of fighters) {
    if (f._dogHitT > 0) f._dogHitT -= dt;
    if (dog.state !== "dead" && f.alive && (f.state === "attack" || f.state === "special") && (f._dogHitT || 0) <= 0) {
      const d = dog.x - f.x;
      if (Math.abs(d) < S(DOG_BITE_RANGE) + DOG_HITBOX && d * f.facing > -DOG_HITBOX) {
        dogTakeDamage(Math.max(4, f.d.power || 8), f);
        f._dogHitT = 0.35;
      }
    }
  }
}

function dogTakeDamage(dmg, attacker) {
  if (!dog || dog.state === "dead") return;
  dog.hp -= dmg; dog.hitFlash = 0.2;
  if (typeof spawnHitFx === "function") spawnHitFx(dog.x, GROUND - S(22), "#9c1d2e", 6);
  if (dog.hp <= 0) {
    dog.hp = 0; dog.state = "dead"; dog.dead = 0;
    if (attacker && attacker.alive) dogGrantBuff(attacker);
  }
}

/* Melee reach damage — called from the basic attack (see engine tryAttack hook). */
function hitDog(x, facing, range, attacker, dmg) {
  if (!dog || dog.state === "dead") return false;
  const d = dog.x - x;
  if (Math.abs(d) < range + DOG_HITBOX && d * facing > -DOG_HITBOX) { dogTakeDamage(dmg, attacker); return true; }
  return false;
}

function dogGrantBuff(f) {
  f.dogBuff = DOG_BUFF_SEC;
  statusFloat(f, "RABID FANGS!", "#9dff5e");
  if (typeof ringFx === "function") ringFx(f.x, f.centerY, "#9dff5e", 70);
}

/* Called by the engine's basic attack when it lands: if the attacker holds the buff,
   add bonus poison to whoever they hit. */
function dogBuffOnHit(attacker, foe) {
  if (!attacker || (attacker.dogBuff || 0) <= 0 || !foe || !foe.alive) return;
  foe.poisonDps = DOG_BUFF_POISON_DPS; foe.poison = Math.max(foe.poison || 0, DOG_BUFF_POISON_SEC);
  foe.takeDamage(DOG_BUFF_BONUS, 0, 0, { unblockable: true, dot: true, col: "#9dff5e", fx: "#9dff5e" });
  statusFloat(foe, "POISON", "#9dff5e");
}

function drawDog() {
  if (!dog) return;
  let frame;
  if (dog.state === "dead") frame = "hit";
  else if (dog.hitFlash > 0) frame = "hit";
  else if (dog.state === "attack") frame = (dog.runAttack || dog.t >= 0.2) ? "attack" : "idle";
  else if (dog.state === "run") frame = (Math.floor(dog.t * 10) % 2) ? "run2" : "run1";
  else frame = "idle";
  const img = DOG_IMG[frame];
  const base = DOG_BASE_FACE[frame] || -1;
  const flip = dog.facing !== base;

  ctx.save();
  ctx.translate(Math.round(dog.x), 0);
  if (dog.state === "dead") ctx.globalAlpha = Math.max(0, 1 - dog.dead / 0.6);
  if (flip) ctx.scale(-1, 1);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, -DOG_SIZE / 2, GROUND + DOG_FOOT - DOG_SIZE, DOG_SIZE, DOG_SIZE);
  } else {
    // placeholder until the PNGs are placed — the mechanic still works/visible
    ctx.fillStyle = "#8a5a2b"; ctx.fillRect(-24, GROUND - 26, 48, 22);
    ctx.fillStyle = "#6b4420"; ctx.fillRect(16, GROUND - 30, 12, 10); ctx.fillRect(-30, GROUND - 8, 8, 10);
  }
  ctx.restore();

  // HP bar above the dog
  const bw = 44, bx = Math.round(dog.x - bw / 2), by = GROUND - Math.round(DOG_SIZE * 0.6);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000"; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
  ctx.fillStyle = "#3a1414"; ctx.fillRect(bx, by, bw, 4);
  ctx.fillStyle = (dog.hp / dog.maxhp > 0.4) ? "#8fd45a" : "#e2384a";
  ctx.fillRect(bx, by, Math.round(bw * Math.max(0, dog.hp / dog.maxhp)), 4);

  // periodic "HAV HAV!" bark bubble while chasing/running (reuses the toilet bubble style)
  if (dog.state === "run" && typeof nbBubble === "function") {
    const cyc = tGlobal % 1.5;                       // ~every 1.5s
    if (cyc < 0.75) {                                // show for the first 0.75s, then gap
      const fade = cyc > 0.55 ? (0.75 - cyc) / 0.2 : 1;
      nbBubble(dog.x + dog.facing * 6, by - 3, ["HAV HAV!"], cyc, fade);
    }
  }
}

/* Serialize / restore for online snapshots (host -> guest). */
function dogSerialize() {
  if (!dog) return null;
  return { x: dog.x, y: dog.y, facing: dog.facing, state: dog.state, t: dog.t, hp: dog.hp, maxhp: dog.maxhp, hitFlash: dog.hitFlash, dead: dog.dead, runAttack: dog.runAttack };
}
function dogApply(d) { dog = d ? { x: d.x, y: d.y, facing: d.facing, state: d.state, t: d.t, hp: d.hp, maxhp: d.maxhp, hitFlash: d.hitFlash, dead: d.dead, runAttack: d.runAttack } : null; }
