// The simulation: the thief, three patrolling guards, two sweeping cameras, the alarm
// meter, the loot and the exit. Everything moves in fixed 1/60 s steps; the renderer only
// paints what is here, and the screenshot scenes only stage what is here.

import { ALARM, CAMERA, GUARD, LOOT, PLAYER, STEP, TIME_BONUS } from './config.js';
import {
  CAMERAS,
  EXIT_ZONE,
  GUARD_PATROLS,
  LOOT_SPOTS,
  PANEL,
  PLAYER_START,
  clampInRoom,
  lineBlocked,
  moveCircle,
  pointInRect,
} from './level.js';

export const EVENT_GRAB = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_WIN = 4;
export const EVENT_ALARM_HIGH = 8;
export const EVENT_COIN = 16;
export const EVENT_PANEL = 32;

/** Smallest signed angle from `from` to `to`, in (-PI, PI]. */
function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Turn `angle` toward `target` by at most `maxTurn` radians. */
function turnToward(angle, target, maxTurn) {
  const d = angleDiff(angle, target);
  if (Math.abs(d) <= maxTurn) return target;
  return angle + Math.sign(d) * maxTurn;
}

function makeGuard(patrol) {
  const start = patrol[0];
  return {
    x: start.x,
    y: start.y,
    angle: Math.PI / 2,
    patrol,
    waypoint: 1,
    waitTimer: 0,
    mode: 'patrol',
    suspicion: 0,
    lastSeen: { x: start.x, y: start.y },
    investigateTimer: 0,
    chaseTimer: 0,
    lookTimer: 0,
  };
}

function makeCamera(spec) {
  return { ...spec, angle: spec.baseAngle, disabledUntil: -1, seesPlayer: false };
}

export function createWorld() {
  const state = {
    time: 0,
    alarm: 0,
    score: 0,
    lootTaken: 0,
    over: false,
    won: false,
    player: {
      x: PLAYER_START.x,
      y: PLAYER_START.y,
      angle: -Math.PI / 2,
      sneaking: false,
      coins: PLAYER.coins,
      moving: false,
    },
    guards: GUARD_PATROLS.map(makeGuard),
    cameras: CAMERAS.map(makeCamera),
    loot: LOOT_SPOTS.map((spot) => ({ ...spot })),
    coin: null,
    panelCooldownUntil: -1,
    shake: 0,
    alarmWasHigh: false,
  };

  function reset() {
    state.time = 0;
    state.alarm = 0;
    state.score = 0;
    state.lootTaken = 0;
    state.over = false;
    state.won = false;
    state.player.x = PLAYER_START.x;
    state.player.y = PLAYER_START.y;
    state.player.angle = -Math.PI / 2;
    state.player.sneaking = false;
    state.player.coins = PLAYER.coins;
    state.player.moving = false;
    state.guards = GUARD_PATROLS.map(makeGuard);
    state.cameras = CAMERAS.map(makeCamera);
    state.loot = LOOT_SPOTS.map((spot) => ({ ...spot }));
    state.coin = null;
    state.panelCooldownUntil = -1;
    state.shake = 0;
    state.alarmWasHigh = false;
  }

  /** Can this watcher (guard or camera) see the point right now? */
  function canSee(watcher, range, halfAngle, x, y, sneaking) {
    const dx = x - watcher.x;
    const dy = y - watcher.y;
    const dist = Math.hypot(dx, dy);
    const notice = sneaking ? PLAYER.sneakNotice : 1;
    if (dist > range * notice) return false;
    if (dist > 4 && Math.abs(angleDiff(watcher.angle, Math.atan2(dy, dx))) > halfAngle) return false;
    return !lineBlocked(watcher.x, watcher.y, x, y);
  }

  /** Would the thief be seen standing at (x, y)? A query for tests and tooling. */
  function wouldBeSeen(x, y, sneaking) {
    for (const guard of state.guards) {
      if (canSee(guard, GUARD.coneRange, GUARD.coneHalfAngle, x, y, sneaking)) return true;
    }
    for (const camera of state.cameras) {
      if (state.time < camera.disabledUntil) continue;
      if (canSee(camera, CAMERA.coneRange, CAMERA.coneHalfAngle, x, y, sneaking)) return true;
    }
    return false;
  }

  function nearestLoot() {
    let best = null;
    let bestDist = Infinity;
    for (const item of state.loot) {
      if (item.taken) continue;
      const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return { item: best, dist: bestDist };
  }

  function stepGuard(guard, dt) {
    const player = state.player;
    const visible = canSee(guard, GUARD.coneRange, GUARD.coneHalfAngle, player.x, player.y, player.sneaking);
    if (visible) {
      const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
      const closeness = 1.15 - (0.65 * dist) / GUARD.coneRange;
      guard.suspicion = Math.min(1, guard.suspicion + GUARD.suspicionRate * Math.max(0.35, closeness) * dt);
      guard.lastSeen = { x: player.x, y: player.y };
      if (guard.suspicion >= 1 && guard.mode !== 'alert') {
        guard.mode = 'alert';
        guard.chaseTimer = GUARD.chaseMemory;
      }
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
    }

    if (guard.mode === 'alert') {
      const target = { x: player.x, y: player.y };
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < GUARD.catchRadius) return EVENT_CAUGHT;
      guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 9 * dt);
      const moved = moveCircle(guard.x, guard.y, (dx / dist) * GUARD.chaseSpeed * dt, (dy / dist) * GUARD.chaseSpeed * dt, GUARD.radius);
      guard.x = moved.x;
      guard.y = moved.y;
      if (!visible) {
        guard.chaseTimer -= dt;
        if (guard.chaseTimer <= 0) {
          guard.mode = 'investigate';
          guard.investigateTimer = GUARD.investigateSeconds;
        }
      }
      return 0;
    }

    if (guard.mode === 'investigate') {
      const target = guard.lastSeen;
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) {
        guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 7 * dt);
        const moved = moveCircle(guard.x, guard.y, (dx / dist) * GUARD.investigateSpeed * dt, (dy / dist) * GUARD.investigateSpeed * dt, GUARD.radius);
        guard.x = moved.x;
        guard.y = moved.y;
      } else {
        guard.investigateTimer -= dt;
        guard.angle += dt * 1.6;
        if (guard.investigateTimer <= 0) {
          guard.mode = 'patrol';
          guard.suspicion = 0.25;
        }
      }
      return 0;
    }

    // Patrol: walk the loop, pausing at each waypoint. A high alarm sends every guard
    // hunting the thief's current spot instead of its waypoints.
    let target;
    if (state.alarm >= ALARM.huntAt) {
      target = { x: player.x, y: player.y };
    } else {
      target = guard.patrol[guard.waypoint];
    }
    if (visible && guard.suspicion >= 0.45) {
      // Suspicious: stop and stare at the thief.
      guard.angle = turnToward(guard.angle, Math.atan2(player.y - guard.y, player.x - guard.x), 8 * dt);
      return 0;
    }
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      if (state.alarm < ALARM.huntAt) {
        if (guard.waitTimer <= 0) guard.waitTimer = 0.6;
        guard.waitTimer -= dt;
        guard.angle += dt * 0.9;
        if (guard.waitTimer <= 0) guard.waypoint = (guard.waypoint + 1) % guard.patrol.length;
      }
      return 0;
    }
    guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 7 * dt);
    const moved = moveCircle(guard.x, guard.y, (dx / dist) * GUARD.patrolSpeed * dt, (dy / dist) * GUARD.patrolSpeed * dt, GUARD.radius);
    guard.x = moved.x;
    guard.y = moved.y;
    return 0;
  }

  function stepCamera(camera, dt) {
    camera.angle = camera.baseAngle + Math.sin((state.time * Math.PI * 2) / camera.period + camera.phase) * camera.amplitude;
    camera.seesPlayer = false;
    if (state.time < camera.disabledUntil) return 0;
    if (canSee(camera, CAMERA.coneRange, CAMERA.coneHalfAngle, state.player.x, state.player.y, state.player.sneaking)) {
      camera.seesPlayer = true;
      return CAMERA.alarmRate * dt;
    }
    return 0;
  }

  /**
   * Advance the world one fixed step. `input` is { sx, sy, sneaking, actions } or null for
   * the title screen's ambient drift (guards patrol, cameras sweep, nothing else happens).
   * Returns an event bitmask (EVENT_*).
   */
  function step(dt, input) {
    if (state.over) return 0;
    state.time += dt;
    let events = 0;

    // Cameras always sweep; guards always patrol on the title screen.
    let cameraAlarm = 0;
    for (const camera of state.cameras) cameraAlarm += stepCamera(camera, dt);

    if (input === null) {
      for (const guard of state.guards) stepGuard(guard, dt);
      return 0;
    }

    const player = state.player;
    const speed = input.sneaking ? PLAYER.sneakSpeed : PLAYER.speed;
    player.sneaking = input.sneaking;
    player.moving = input.sx !== 0 || input.sy !== 0;
    if (player.moving) {
      player.angle = turnToward(player.angle, Math.atan2(input.sy, input.sx), 14 * dt);
      const moved = moveCircle(player.x, player.y, input.sx * speed * dt, input.sy * speed * dt, PLAYER.radius);
      player.x = moved.x;
      player.y = moved.y;
    }

    // One-shot actions, taken from the input flags.
    const actions = input.actions || 0;
    if (actions & 2) {
      // Interact: grab loot, or disable the cameras at the panel.
      const { item, dist } = nearestLoot();
      if (item && dist <= PLAYER.grabRange) {
        item.taken = true;
        state.lootTaken += 1;
        state.score += LOOT[item.id].points;
        events |= EVENT_GRAB;
      } else if (
        Math.hypot(PANEL.x + PANEL.w / 2 - player.x, PANEL.y + PANEL.h / 2 - player.y) <= 56 &&
        state.time >= state.panelCooldownUntil
      ) {
        for (const camera of state.cameras) camera.disabledUntil = state.time + CAMERA.disabledSeconds;
        state.panelCooldownUntil = state.time + CAMERA.panelCooldown;
        events |= EVENT_PANEL;
      }
    }
    if (actions & 4) {
      // Toss a coin ahead: guards near where it lands go to look.
      if (player.coins > 0) {
        player.coins -= 1;
        const landing = clampInRoom(
          player.x + Math.cos(player.angle) * PLAYER.coinRange,
          player.y + Math.sin(player.angle) * PLAYER.coinRange,
          20,
        );
        state.coin = { x: landing.x, y: landing.y, timer: 4 };
        events |= EVENT_COIN;
        for (const guard of state.guards) {
          if (guard.mode === 'alert') continue;
          if (Math.hypot(guard.x - landing.x, guard.y - landing.y) < 280) {
            guard.mode = 'investigate';
            guard.lastSeen = { x: landing.x, y: landing.y };
            guard.investigateTimer = 2.5;
          }
        }
      }
    }
    if (state.coin) {
      state.coin.timer -= dt;
      if (state.coin.timer <= 0) state.coin = null;
    }

    // Guards and the alarm.
    let guardSees = false;
    for (const guard of state.guards) {
      const result = stepGuard(guard, dt);
      if (result & EVENT_CAUGHT) {
        state.over = true;
        return EVENT_CAUGHT;
      }
      if (canSee(guard, GUARD.coneRange, GUARD.coneHalfAngle, player.x, player.y, player.sneaking)) guardSees = true;
    }
    if (guardSees) state.alarm = Math.min(ALARM.max, state.alarm + ALARM.guardRate * dt);
    state.alarm = Math.min(ALARM.max, state.alarm + cameraAlarm);
    if (!guardSees && cameraAlarm === 0) state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    if (state.alarm >= ALARM.max) {
      state.over = true;
      return EVENT_CAUGHT;
    }
    if (state.alarm >= 75 && !state.alarmWasHigh) {
      state.alarmWasHigh = true;
      state.shake = 0.45;
      events |= EVENT_ALARM_HIGH;
    } else if (state.alarm < 60) {
      state.alarmWasHigh = false;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);

    // The win: all three loot items in hand and standing in the exit zone.
    if (state.lootTaken === 3 && pointInRect(player.x, player.y, EXIT_ZONE)) {
      state.over = true;
      state.won = true;
      state.score += Math.max(0, Math.round(TIME_BONUS.parSeconds - state.time)) * TIME_BONUS.pointsPerSecond;
      return events | EVENT_WIN;
    }
    return events;
  }

  return { state, reset, step, wouldBeSeen };
}
