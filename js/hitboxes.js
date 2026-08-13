/**
 * Visual hitbox data + runtime helpers for What Just Hit Me.
 *
 * Boxes are authored by the Character Lab (js/characterlab.js) and stored in a
 * SPRITE-PIXEL, FACING-RIGHT frame whose origin is the fighter's FEET:
 *     +x = forward (the way the fighter faces),  +y = UP.
 * This is the same unit `S(v)=v*CH_SCALE` maps to world px, so the boxes line up
 * with the drawn sprite exactly (mirror of drawFighter's blit at x=-w/2+dx, y=-h+foot).
 *
 * Structure:
 *   HITBOXES[charId][stateKey] = { hurt?:Box, coll?:Box, attack?:AttackBox }
 *     Box       = { x, y, w, h }            x = forward offset of the near edge,
 *                                           y = height of the bottom edge above the feet
 *     AttackBox = { x, y, w, h, t0, t1 }    active only while f.t in [t0, t1]
 *
 * A character's "default" pseudo-state supplies the hurt/coll box used by any
 * real state that has none of its own, so combat has a body box everywhere.
 */
"use strict";

const HITBOXES = {};                              // charId -> stateKey -> { hurt, coll, attack }
const HITBOX_STORAGE_KEY = "wjhm-hitboxes-v1";
/** Optional per-frame sprite ALIGNMENT tweaks authored in the lab: charId -> stateKey -> {dx,foot,w,h}. */
const SPRITE_ALIGN = {};
const SPRITE_ALIGN_KEY = "wjhm-spritealign-v1";
/** Per-character uniform SIZE multiplier: charId -> scale. Acts like a personal CH_SCALE, so it scales
 *  every one of that character's sprites AND their authored boxes together (no re-drawing needed). */
const CHAR_SCALE = {};
const CHAR_SCALE_KEY = "wjhm-charscale-v1";
/** The size multiplier for a character (1 = default). */
function charScaleOf(id){ return (CHAR_SCALE[id] > 0) ? CHAR_SCALE[id] : 1; }
/** ANIMATION SPEED (fps) authoring. The tool stores a MACRO per-character multiplier + MICRO per-animation
 *  fps, and flattens them into a per-state TIME-SCALE the engine multiplies into the state clock (f.t).
 *  1 = the animation's natural/current speed, >1 = faster, <1 = slower. Safe by default (missing = 1). */
const CHAR_ANIM_SPEED = {};   // charId -> macro multiplier (tool round-trip)
const ANIM_FPS = {};          // charId -> animName -> fps (tool round-trip)
const ANIM_TSCALE = {};       // charId -> stateKey -> time-scale (what the engine actually consumes)
/** The time-scale the engine applies to a fighter's state clock for its current frame (1 = unchanged). */
function animTScaleOf(id, key){ const c = ANIM_TSCALE[id]; const v = c && key && c[key]; return (v > 0) ? v : 1; }

/** Per-character STAT overrides authored in the tool: charId -> {hp, armor, speed, jump, power, skillDmg}.
 *  hp/armor/speed/jump/power override the character definition; skillDmg multiplies the damage of that
 *  character's skill hits (applied live in takeDamage). Missing fields keep the original value. */
const CHAR_STATS = {};
let _CHAR_STATS_ORIG = null;
/** Re-apply stat overrides onto the CHARS definitions (idempotent + reset-safe). Call after the character
 *  modules load, and again whenever the tool changes stats. */
function applyCharStats(){
  if(typeof CHARS === "undefined") return;
  if(!_CHAR_STATS_ORIG){ _CHAR_STATS_ORIG = {}; for(const c of CHARS) _CHAR_STATS_ORIG[c.id] = { hp:c.hp, armor:c.armor, speed:c.speed, jump:c.jump, power:c.power }; }
  for(const c of CHARS){
    const o = _CHAR_STATS_ORIG[c.id]; if(!o) continue;
    const s = CHAR_STATS[c.id] || {};
    c.hp    = (s.hp    > 0)  ? s.hp    : o.hp;
    c.armor = (s.armor >= 0) ? s.armor : o.armor;
    c.speed = (s.speed > 0)  ? s.speed : o.speed;
    c.jump  = (s.jump  > 0)  ? s.jump  : o.jump;
    c.power = (s.power >= 0) ? s.power : o.power;
  }
}
/** Skill-damage multiplier for a character (1 = unchanged). */
function skillDmgMultOf(id){ const s = CHAR_STATS[id]; return (s && s.skillDmg > 0) ? s.skillDmg : 1; }

function loadHitboxes(){
  try{ const raw = localStorage.getItem(HITBOX_STORAGE_KEY); if(raw) Object.assign(HITBOXES, JSON.parse(raw)); }
  catch(e){ console.warn("hitboxes: load failed", e); }
  try{ const raw = localStorage.getItem(SPRITE_ALIGN_KEY); if(raw) Object.assign(SPRITE_ALIGN, JSON.parse(raw)); }
  catch(e){ console.warn("spritealign: load failed", e); }
  try{ const raw = localStorage.getItem(CHAR_SCALE_KEY); if(raw) Object.assign(CHAR_SCALE, JSON.parse(raw)); }
  catch(e){}
  try{ const raw = localStorage.getItem("wjhm-animtscale-v1"); if(raw) Object.assign(ANIM_TSCALE, JSON.parse(raw)); }
  catch(e){}
}
function saveHitboxes(){
  try{ localStorage.setItem(HITBOX_STORAGE_KEY, JSON.stringify(HITBOXES)); }catch(e){ console.warn("hitboxes: save failed", e); }
  try{ localStorage.setItem(SPRITE_ALIGN_KEY, JSON.stringify(SPRITE_ALIGN)); }catch(e){}
  try{ localStorage.setItem(CHAR_SCALE_KEY, JSON.stringify(CHAR_SCALE)); }catch(e){}
}

/** Boxes for a character+state, or the character's `default` entry as a fallback. */
function hitboxesFor(charId, stateKey){
  const c = HITBOXES[charId]; if(!c) return null;
  return c[stateKey] || c["default"] || null;
}
/** The body HURT box for a fighter right now (state override, else character default). */
function hurtBoxFor(charId, stateKey){
  const c = HITBOXES[charId]; if(!c) return null;
  const s = c[stateKey]; if(s && s.hurt) return s.hurt;
  return (c["default"] && c["default"].hurt) || null;
}

/** Authored box (facing-right, feet origin, +y up) -> world-space AABB for the given fighter.
 *  Includes the character's size multiplier so boxes scale with the sprite. */
function boxToWorld(f, box){
  const r = f.facing || 1, cs = charScaleOf(f.d.id);
  const x1 = f.x + r*S(box.x)*cs, x2 = f.x + r*S(box.x + box.w)*cs;
  const bottom = f.y - S(box.y)*cs, top = f.y - S(box.y + box.h)*cs;
  return { left: Math.min(x1,x2), right: Math.max(x1,x2), top: top, bottom: bottom };
}
function aabbOverlap(a, b){
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Convenience: is `box` active this frame (attack boxes gate on f.t; others always). */
function boxActive(box, f){
  if(box.t0 == null && box.t1 == null) return true;
  const t = f.t || 0;
  return t >= (box.t0 || 0) && t <= (box.t1 != null ? box.t1 : Infinity);
}

/** The active attack box on a fighter's currently-shown frame (or null). f._frameKey is set
 *  each render by drawFighter. */
function attackBoxOf(f){
  const key = f._frameKey; if(!key) return null;
  const c = HITBOXES[f.d.id], s = c && c[key], ab = s && s.attack;
  return (ab && boxActive(ab, f)) ? ab : null;
}
/** Does f's melee attack connect with foe? Box-based when BOTH an attack box (attacker) and a hurt
 *  box (defender) are authored; otherwise the legacy reach/vertical heuristic (so nothing regresses). */
function meleeConnects(f, foe, reach, hH){
  const ab = attackBoxOf(f), hb = foe._toolDummy ? (typeof DUMMY_HURT!=="undefined"?DUMMY_HURT:null) : hurtBoxFor(foe.d.id, foe._frameKey);
  if(ab && hb) return aabbOverlap(boxToWorld(f, ab), boxToWorld(foe, hb));
  const dx = foe.x - f.x;
  return Math.abs(dx) < S(reach) && dx*f.facing > -10 && Math.abs(foe.hurtY - f.centerY) < S(hH);
}

/** Apply authored sprite-alignment tweaks onto the loaded IMG_SPRITES frames. Call AFTER
 *  the character modules have populated IMG_SPRITES (see characterlab.js bottom). */
function applySpriteAlign(){
  if(typeof IMG_SPRITES === "undefined") return;
  for(const c in SPRITE_ALIGN){ const set = IMG_SPRITES[c]; if(!set) continue;
    for(const s in SPRITE_ALIGN[c]){ const fr = set[s]; if(!fr) continue; const a = SPRITE_ALIGN[c][s];
      if(a.dx != null) fr.dx = a.dx; if(a.foot != null) fr.foot = a.foot;
      if(a.w != null) fr.w = a.w; if(a.h != null) fr.h = a.h; } }
}

if(typeof loadHitboxes === "function") loadHitboxes();
