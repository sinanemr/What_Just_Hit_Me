/**
 * KABATEPE — editable stage-object registry.
 *
 * ONE authoritative place that tells the Map Editor which stage objects are movable and where their
 * REAL game anchor is. Plain <script>, loaded AFTER every stage-object file (so it can read their own
 * constants) and AFTER js/map-system.js (needs mapRegister). No duplicated coordinates: each entry
 * reads the object's own _X/_Y (single objects) or the centre of its _PLACES array (clustered groups).
 *
 * For an object to be MOVABLE two things are wired:
 *   1) it is registered here  -> the editor shows it + a handle at its real anchor
 *   2) its draw call in js/engine.js is wrapped in mapDraw("<id>", drawFn) -> the move/scale applies
 *
 * Anchor = the object's real game anchor (ground-contact / draw anchor), NOT the visual sprite centre.
 * layer is informational (back = behind fighters, fore = drawn in front).
 */
"use strict";
(function () {
  if (typeof mapRegister !== "function") return;
  const reg = (id, x, y, label, layer) => mapRegister(id, { x: Math.round(x), y: Math.round(y), label, layer: layer || "back", movable: true });
  // centre of a placement array (optionally + a group SHIFT), for clustered decor moved as one unit
  const cen = (arr, key, add) => { if (!Array.isArray(arr) || !arr.length) return 0; let s = 0; for (const p of arr) s += (p[key] || 0); return s / arr.length + (add || 0); };

  /* ---- single independent objects (anchor = its own _X/_Y) ---- */
  if (typeof LightHouse_X !== "undefined") reg("lighthouse", LightHouse_X, LightHouse_Y, "Lighthouse", "back");
  if (typeof CO2Tank_X !== "undefined") reg("co2tank", CO2Tank_X, CO2Tank_Y, "CO₂ Tank", "fore");
  if (typeof WetsuitsDry_X !== "undefined") reg("wetsuits", WetsuitsDry_X, WetsuitsDry_Y, "Wetsuit Rack", "back");
  if (typeof BAL_X !== "undefined") reg("balik", BAL_X, BAL_Y, "Fisherman", "back");
  if (typeof COMP_X !== "undefined") reg("compressor", COMP_X, COMP_Y, "Compressor NPC", "back");
  if (typeof CompMech_X !== "undefined") reg("compressorMech", CompMech_X, CompMech_Y, "Compressor Unit", "back");
  if (typeof FishingRod_X !== "undefined") reg("fishingRod", FishingRod_X, FishingRod_Y, "Fishing Rod", "back");
  if (typeof Fishnet_X !== "undefined") reg("fishnet", Fishnet_X, Fishnet_Y, "Fishnet", "back");
  if (typeof KID_X !== "undefined") reg("kid", KID_X, KID_Y, "Kid on Boat", "back");
  if (typeof KIDS_X !== "undefined") reg("kids", KIDS_X, KIDS_Y, "Talking Kids", "back");
  if (typeof SIT_X !== "undefined") reg("sitter", SIT_X, SIT_Y, "Seated Man", "back");
  if (typeof TOURIST_X !== "undefined") reg("tourist", TOURIST_X, TOURIST_Y, "Tourists", "back");
  if (typeof REG_X !== "undefined") reg("regulator", REG_X, REG_Y, "Diver (regulator)", "fore");

  /* ---- clustered decor groups (moved as one unit; anchor = cluster centre / group origin) ---- */
  if (typeof Pallet_ORIGIN_X !== "undefined") reg("pallets", Pallet_ORIGIN_X, Pallet_ORIGIN_Y, "Pallets", "back");
  if (typeof Fishbox_PLACES !== "undefined") reg("fishbox", cen(Fishbox_PLACES, "x"), cen(Fishbox_PLACES, "y"), "Fish Boxes", "back");
  if (typeof Rope_PLACES !== "undefined") reg("rope", cen(Rope_PLACES, "x"), cen(Rope_PLACES, "y"), "Mooring Ropes", "back");
  if (typeof Seat_PLACES !== "undefined") reg("seat", cen(Seat_PLACES, "x"), cen(Seat_PLACES, "y"), "Plastic Chair", "back");
  if (typeof Umbrella_PLACES !== "undefined") reg("sodaumbrella", cen(Umbrella_PLACES, "x"), cen(Umbrella_PLACES, "y"), "Soda Umbrella", "back");
  if (typeof Stool_PLACES !== "undefined") reg("stool", cen(Stool_PLACES, "x"), cen(Stool_PLACES, "y"), "Stool", "back");
  if (typeof Bgammon_PLACES !== "undefined") reg("blackgammon", cen(Bgammon_PLACES, "x"), cen(Bgammon_PLACES, "y"), "Backgammon Table", "back");
  if (typeof Scuba_PLACES !== "undefined") reg("scubaglasses", cen(Scuba_PLACES, "x", typeof Scuba_SHIFT_X !== "undefined" ? Scuba_SHIFT_X : 0), cen(Scuba_PLACES, "y", typeof Scuba_SHIFT_Y !== "undefined" ? Scuba_SHIFT_Y : 0), "Diving Masks", "fore");
  if (typeof YFin_PLACES !== "undefined") reg("yellowfin", cen(YFin_PLACES, "x", typeof YFin_SHIFT_X !== "undefined" ? YFin_SHIFT_X : 0), cen(YFin_PLACES, "y", typeof YFin_SHIFT_Y !== "undefined" ? YFin_SHIFT_Y : 0), "Diving Fins", "back");
})();
