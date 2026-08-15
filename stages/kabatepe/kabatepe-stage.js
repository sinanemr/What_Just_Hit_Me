/**
 * KABATEPE PORT — stage entry point (Karatepe İskelesi).
 *
 * This is the primary definition for the Kabatepe stage. Plain <script> (shared globals), loaded
 * AFTER js/map-system.js (it needs mapRegister) and BEFORE js/engine.js.
 *
 * All Kabatepe-specific stage code lives under stages/kabatepe/:
 *   kabatepe-stage.js   — this file: stage metadata (id / name / dimensions accessor)
 *   kabatepe-objects.js — the editable-object REGISTRY (map anchors) read by the Map Editor; loaded
 *                         after every object file so it can read each object's real anchor constant
 *   map-data.js         — auto-generated per-object move/size overrides + world-limit overrides
 *   <object>.js         — the individual decor / props / NPCs / vehicles / effects / hazards
 *                         (lighthouse, CO2Tank, pallet, cars, boats' crews, birds, waves, dog, …),
 *                         each drawn from renderGame() in the shared engine via its global draw fn.
 *
 * NOTE: the world dimensions / ground / walls / spawns are still the shared engine defaults in
 * js/config.js (Kabatepe is the only stage today). This file reads them live (no duplicated
 * literals) so there is ONE authoritative source; when a second stage is added they move here.
 */
"use strict";

/* Stage descriptor — read-only view over the authoritative config (no duplicate values). */
const STAGE_KABATEPE = {
  id: 0,
  name: "Kabatepe Port — Karatepe İskelesi",
  background: "assets/stages/kabatepe/background.png",   // document-relative (resolved by RUN_GAME.html)
  get worldW() { return (typeof CFG !== "undefined") ? CFG.world.width : 2032; },
  get ground() { return (typeof CFG !== "undefined") ? CFG.world.ground : 230; },
  get leftWall() { return (typeof CFG !== "undefined") ? CFG.world.leftWall : 20; },
  get rightWall() { return (typeof CFG !== "undefined") ? CFG.world.rightWall : 2012; }
};

/* Editable stage objects are registered in stages/kabatepe/kabatepe-objects.js (loaded last, after
   every object file, so it can read each object's own real anchor constant). The Map Editor reads
   MAP_ANCHORS at runtime. Keeping the registry there — not here — means anchors stay authoritative
   (single source per object) instead of duplicated literals. */
