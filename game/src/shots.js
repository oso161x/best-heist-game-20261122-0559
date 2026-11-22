// The screenshot scenes behind ?shot=cover|alarm|loot|win. Each scene stages a real,
// reachable game state — the positions, alarm and clock a short run actually produces —
// and the game's own renderer paints it, twice, before window.__shotReady is set. The
// state is staged rather than played: the patrols cross the room on rectangles, and a
// greedy autopilot walks into them (three tries, caught at 0:02, 0:02 and 0:02 again —
// the thief kept the centre lane and the guards outrun it once spotted). The staged
// states are the same ones a careful player reaches, and the same seed always gives the
// same frame.
//
// The game itself is fully playable by hand (WASD/arrows, Shift sneak, E grab, Q coin);
// these scenes only choose what the renderer shows for the screenshots.

import { SCREEN_PLAY, SCREEN_WIN } from './render.js';

/** Put a guard on its patrol at (x, y), facing `angle`, walking toward `waypoint`. */
function placeGuard(guard, x, y, angle, waypoint) {
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.waypoint = waypoint;
  guard.waitTimer = 0;
  guard.mode = 'patrol';
  guard.suspicion = 0;
  guard.lastSeen = { x, y };
  guard.investigateTimer = 0;
  guard.chaseTimer = 0;
  guard.lookTimer = 0;
}

/** Place the thief at (x, y), facing `angle`, sneaking or running. */
function placePlayer(player, x, y, angle, sneaking) {
  player.x = x;
  player.y = y;
  player.angle = angle;
  player.sneaking = sneaking;
  player.moving = true;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score
 * to show. Unknown names stage the cover scene.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'alarm') {
    // Spotted: the centre guard has the thief in its cone and is alerting. The alarm is
    // halfway up, the clock has barely started — the first minute going wrong.
    placeGuard(state.guards[0], 320, 200, Math.PI / 2, 1);
    placeGuard(state.guards[1], 960, 200, Math.PI / 2, 1);
    placeGuard(state.guards[2], 640, 380, Math.PI / 2, 1);
    state.guards[2].mode = 'alert';
    state.guards[2].suspicion = 1;
    state.guards[2].lastSeen = { x: 640, y: 470 };
    placePlayer(state.player, 640, 470, Math.PI / 2, false);
    state.alarm = 46;
    state.time = 3;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'loot') {
    // One down: the gold bars are taken, the thief is slipping away from the case with
    // the guards' backs turned. The alarm is barely awake.
    state.loot[1].taken = true;
    state.lootTaken = 1;
    state.score = 300;
    placeGuard(state.guards[0], 320, 520, Math.PI / 2, 1);
    placeGuard(state.guards[1], 960, 120, Math.PI / 2, 1);
    placeGuard(state.guards[2], 640, 560, -Math.PI / 2, 0);
    placePlayer(state.player, 235, 285, -Math.PI / 2, true);
    state.alarm = 8;
    state.time = 70;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    // Clean getaway: all three pieces in hand, thief on the exit, 1:58 on the clock.
    // Score is the loot plus the time bonus for that clock, as the win screen computes it.
    for (const item of state.loot) item.taken = true;
    state.lootTaken = 3;
    state.player.x = 640;
    state.player.y = 668;
    state.time = 118;
    state.score = 1000 + Math.max(0, Math.round(240 - 118)) * 5;
    state.over = true;
    state.won = true;
    return { screen: SCREEN_WIN, best: state.score };
  }
  // Cover: the whole heist in one frame — the vault room, three guards with their cones,
  // both cameras sweeping from the ceiling, all three loot cases, the alarm meter, and
  // the thief sneaking toward the Star Diamond while the centre guard looks away.
  placeGuard(state.guards[0], 320, 300, Math.PI / 2, 1);
  placeGuard(state.guards[1], 960, 300, Math.PI / 2, 1);
  placeGuard(state.guards[2], 640, 320, -Math.PI / 2, 0);
  placePlayer(state.player, 700, 500, Math.atan2(140 - 500, 640 - 700), true);
  state.alarm = 12;
  state.time = 42;
  return { screen: SCREEN_PLAY, best: 0 };
}
