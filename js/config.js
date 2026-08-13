/**
 * Central game configuration — the values you are most likely to edit.
 * Every value below was verified against what-just-hit-me_alpha13.1.html.
 *
 * Loaded as a plain <script> (not an ES module) so the game runs by double-clicking
 * index.html (file://) as well as from a web server. It defines GAME_CONFIG (alias
 * CFG) and applyViewport() as globals that js/engine.js uses.
 *
 * Changing GAME_CONFIG.viewport.width cascades to the camera width, canvas logical
 * size + backing (supersampled) resolution, camera clamping, HUD width, stage crop
 * and the responsive fight-container width — no CSS edits needed.
 */
// Dev-tool embed (?tool=1 on the URL): use a TALLER viewport so the practice arena is a vertical
// space (full character + headroom for jumps), and drop the ground near the bottom.
const _TOOL_EMBED = (typeof location !== "undefined") && /[?&]tool=1(?:&|$)/.test(location.search || "");

const GAME_CONFIG = {
  gameSpeed: 0.8,      // GAME_SPEED — global simulation speed (1 = normal; <1 slows the WHOLE game
                       //   uniformly: movement, gravity, jumps, animations, cooldowns, timers).
  viewport: {
    width: 720,        // W  — visible world width (logical px); the camera window
    height: _TOOL_EMBED ? 560 : 270,   // H  — visible world height (logical px); taller in the dev tool
    renderScale: 2     // RENDER_SCALE — supersample: canvas backing = width*scale
  },
  world: {
    width: 2032,       // WORLD_W — total scrollable stage width
    ground: _TOOL_EMBED ? 500 : 230,   // GROUND  — y of the ground line (logical px); lower = fighters stand further back/up
    gravity: 1200,     // GRAV    — downward acceleration (px/s^2)
    leftWall: 20,      // WALL_L  — invisible left bound (widened: near the full stage)
    rightWall: 2012    // WALL_R  — invisible right bound (widened: near the full stage)
  },
  match: {
    roundTime: 60,     // seconds per round (timer)
    winsRequired: 2,   // round wins to take the match (best of 3)
    maximumEnergy: 100 // ult meter cap (gainMeter clamps to this)
  },
  fighters: {
    scale: 0.78,       // CH_SCALE — sprite px -> world px
    player1Spawn: 780, // SPAWN_1 — around the boat (left of it)
    player2Spawn: 1050 // SPAWN_2 — around the boat (right of it); car prop sits further right at ~1140
  },
  camera: {
    followSpeed: 4.5   // camX += (target-camX)*min(1, dt*followSpeed). 13.1 uses 4.5 (NOT 8).
  }
};

// Alias the engine uses throughout.
const CFG = GAME_CONFIG;

/**
 * Size the canvas to the supersampled backing resolution and publish the display
 * width as a CSS variable. The engine then draws in logical world coordinates
 * after ctx.scale(renderScale). Returns the 2D context.
 */
function applyViewport(canvas) {
  const { width, height, renderScale } = GAME_CONFIG.viewport;
  canvas.width = width * renderScale;
  canvas.height = height * renderScale;
  const root = document.documentElement.style;
  root.setProperty("--game-display-width", `${width * renderScale}px`);
  root.setProperty("--game-aspect", `${width} / ${height}`);
  return canvas.getContext("2d");
}
