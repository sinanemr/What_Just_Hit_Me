/**
 * Map override system — lets the Map Editor move/resize stage objects and change the world limits
 * without hand-editing each decor file. Plain <script>, loaded right after config.js (before engine.js
 * so world-limit overrides reach CFG before the engine reads them).
 *
 *   MAP_DATA.limits  = { wallL, wallR, worldW }                 (optional overrides -> applied to CFG)
 *   MAP_DATA.objects = { <id>: { dx, dy, scale } }              per-object move (world px) + resize
 *   MAP_ANCHORS[id]  = { x, y, label, gameplay }               each object's base anchor (the scale pivot
 *                                                               + where the editor draws its handle)
 *
 * Decor DRAW calls are wrapped with mapDraw(id, fn) in renderGame (visual move/scale). Objects with
 * GAMEPLAY read their live world position through mapGX/mapGY and their size through mapGS.
 */
"use strict";

const MAP_DATA = { limits: {}, objects: {} };
const MAP_ANCHORS = {};
/* Pristine world limits captured BEFORE any override is applied (config.js runs before this file, and
   map-data.js — which calls mapApplyLimits — runs after). Lets the Map Editor show true defaults + reset. */
const MAP_LIMIT_BASE = (typeof CFG !== "undefined")
  ? { wallL: CFG.world.leftWall, wallR: CFG.world.rightWall, worldW: CFG.world.width }
  : { wallL: 20, wallR: 2012, worldW: 2032 };

function mapRegister(id, info) { MAP_ANCHORS[id] = Object.assign(MAP_ANCHORS[id] || {}, info); }
function mapObj(id) { const o = MAP_DATA.objects[id]; return { dx: (o && o.dx) || 0, dy: (o && o.dy) || 0, scale: (o && o.scale > 0) ? o.scale : 1 }; }

/** Wrap a decor draw with its move/scale transform (scale pivots on the registered anchor). Uses the
 *  global `ctx` (the world buffer during renderGame). */
function mapDraw(id, fn) {
  if (typeof fn !== "function") return;
  const o = mapObj(id), a = MAP_ANCHORS[id];
  if (o.dx === 0 && o.dy === 0 && o.scale === 1) { fn(); return; }   // no override -> zero overhead
  ctx.save();
  ctx.translate(o.dx, o.dy);
  if (o.scale !== 1 && a) { ctx.translate(a.x, a.y); ctx.scale(o.scale, o.scale); ctx.translate(-a.x, -a.y); }
  fn();
  ctx.restore();
}

/** Effective GAMEPLAY world position/size for an object (anchor moved by dx/dy, extent scaled about the anchor). */
function mapGX(id, x) { const o = mapObj(id), a = MAP_ANCHORS[id]; return o.dx + (a ? a.x + (x - a.x) * o.scale : x); }
function mapGY(id, y) { const o = mapObj(id), a = MAP_ANCHORS[id]; return o.dy + (a ? a.y + (y - a.y) * o.scale : y); }
function mapGS(id) { return mapObj(id).scale; }

/** Apply world-limit overrides onto CFG (call before the engine reads them). */
function mapApplyLimits() {
  if (typeof CFG === "undefined") return;
  const L = MAP_DATA.limits;
  if (L.wallL != null) CFG.world.leftWall = L.wallL;
  if (L.wallR != null) CFG.world.rightWall = L.wallR;
  if (L.worldW != null) CFG.world.width = L.worldW;
}

/* Stage objects are registered by each STAGE's own definition (e.g. stages/kabatepe/kabatepe-stage.js
   calls mapRegister for the lighthouse / CO₂ tank / pallets). This framework stays stage-agnostic. */
