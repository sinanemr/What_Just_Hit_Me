/**
 * Boot helper (plain <script>, loaded LAST). config.js, controls.js, engine.js and
 * the settings scripts have already run by the time this executes, so the game is up.
 * It paints the on-screen control labels from CONTROLS (no hardcoded keys anywhere)
 * and applies the player's saved settings once everything is loaded.
 *
 * refreshControlLabels() is a GLOBAL so the settings system can repaint the labels
 * live after a remap (no page reload).
 */

/* ---- global: repaint the title/fight control-helper text from CONTROLS ---- */
function refreshControlLabels() {
  const kb = (k) => `<kbd>${keyLabel(k)}</kbd>`;
  const helpLine = (player) => {
    const c = CONTROLS[player];
    return [
      `${kb(c.left)}${kb(c.right)} move`,
      `${kb(c.jump)} jump`,
      `${kb(c.block)} block`,
      `${kb(c.crouch)} crouch`,
      `${kb(c.attack)} attack`,
      `${c.abilities.map(kb).join("")} abilities`,
      `${kb(c.ultimate)} ULT`
    ].join(" · ");
  };
  const title = document.getElementById("titleCtrlHelp");
  const fight = document.getElementById("fightCtrlHelp");
  if (title) title.innerHTML = `P1: ${helpLine("p1")}<br>P2: ${helpLine("p2")}`;
  if (fight) fight.innerHTML =
    `P1: ${helpLine("p1")}  &nbsp;·&nbsp;  P2 / CPU: ${helpLine("p2")}  &nbsp;·&nbsp;  ` +
    `Land hits to fill ENERGY — a full bar unlocks your ULT (${kb(CONTROLS.p1.ultimate)} / ${kb(CONTROLS.p2.ultimate)})!`;
}

(function () {
  validateControls();  // logs a console error on duplicate keys within a player
  bootGame();          // sort roster + preload sprites + build select grid (after all character modules loaded)

  // Push saved settings into the live game. Controls / CPU / DOM classes apply now;
  // fullscreen is deferred until the user interacts (browsers block it without a gesture).
  if (typeof activeSettings !== "undefined") {
    SETTINGS_applyControls(activeSettings);
    SETTINGS_applyCpu(activeSettings);
    SETTINGS_applyVisualDom(activeSettings);
  }

  refreshControlLabels();

  // Title-screen Settings button (added in RUN_GAME.html).
  const titleSettings = document.getElementById("titleSettingsBtn");
  if (titleSettings) titleSettings.addEventListener("click", () => openSettings("title"));

  // DEV TOOL embed (?tool=1): boot straight into the clean practice arena — never show the
  // title / character-select / stage. The Hitbox Editor then drives the character via TOOL_startPractice.
  try {
    const _q = new URLSearchParams(location.search);
    if (_q.get("tool") === "1" && typeof TOOL_startPractice === "function") {
      document.body.classList.add("tool-embed");
      const first = (typeof CHARS !== "undefined" && CHARS.length) ? CHARS[0].id : null;
      if (first) TOOL_startPractice(first);
    }
    // MAP EDITOR embed (?map=1): boot straight into the frozen full-stage map view. Keeps the REAL game
    // viewport/ground (background stays aligned with decor) but fills the iframe like tool-embed.
    if (_q.get("map") === "1" && typeof TOOL_startMapView === "function") {
      document.body.classList.add("map-embed");
      TOOL_startMapView();
    }
  } catch (e) {}
})();
