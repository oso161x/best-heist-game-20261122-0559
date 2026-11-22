// The vault floor: walls, display cases, the loot, the guards' patrols, the cameras and
// the exit. Everything is data here; the world moves it and the renderer paints it.
// Layout rules: patrol lanes run at x = 320, 640 and 960, and no solid rect crosses a lane.

import { FIELD } from './config.js';

const WALL = 24;

/** Solid rectangles the thief and the guards walk around (walls, cases, pillar). */
export const SOLIDS = [
  // Outer walls; the bottom wall leaves a doorway gap at x 600..680.
  { x: 0, y: 0, w: FIELD.width, h: WALL },
  { x: 0, y: 0, w: WALL, h: FIELD.height },
  { x: FIELD.width - WALL, y: 0, w: WALL, h: FIELD.height },
  { x: 0, y: FIELD.height - WALL, w: 600, h: WALL },
  { x: 680, y: FIELD.height - WALL, w: 600, h: WALL },
  // Display cases.
  { x: 590, y: 90, w: 100, h: 60 }, // the Star Diamond's case
  { x: 180, y: 180, w: 110, h: 60 }, // gold bars
  { x: 1010, y: 170, w: 110, h: 60 }, // the painting
  { x: 420, y: 320, w: 120, h: 60 }, // cover case, mid-left
  { x: 760, y: 320, w: 120, h: 60 }, // cover case, mid-right
  { x: 180, y: 460, w: 110, h: 60 }, // cover case, low-left
  { x: 990, y: 460, w: 110, h: 60 }, // cover case, low-right
  { x: 830, y: 470, w: 36, h: 36 }, // pillar
];

/** The three loot items, each resting in its case near the front glass. */
export const LOOT_SPOTS = [
  { id: 'diamond', x: 640, y: 140, taken: false },
  { id: 'gold', x: 235, y: 228, taken: false },
  { id: 'painting', x: 1065, y: 228, taken: false },
];

/** The escape: stand in this zone with all three loot items to win. */
export const EXIT_ZONE = { x: 600, y: 648, w: 80, h: 48 };

/** The security panel: disabling the cameras from here. Walk-over, not solid. */
export const PANEL = { x: 1180, y: 620, w: 40, h: 28 };

export const PLAYER_START = { x: 640, y: 640 };

/** Guard patrols: each is a loop of waypoints the guard walks in order. */
export const GUARD_PATROLS = [
  [
    { x: 320, y: 120 },
    { x: 320, y: 560 },
    { x: 560, y: 560 },
    { x: 560, y: 120 },
  ],
  [
    { x: 960, y: 120 },
    { x: 960, y: 560 },
    { x: 720, y: 560 },
    { x: 720, y: 120 },
  ],
  [
    { x: 640, y: 240 },
    { x: 640, y: 560 },
  ],
];

/** Wall cameras: base point, the angle they sweep around (radians, 0 = east), sweep and period. */
export const CAMERAS = [
  { x: 200, y: 26, baseAngle: Math.PI / 2, amplitude: 0.85, period: 7, phase: 0 },
  { x: 1080, y: 26, baseAngle: Math.PI / 2, amplitude: 0.85, period: 8.5, phase: 2.1 },
];

/** True when the point is inside the rectangle (edges count). */
export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** True when the segment from (x1,y1) to (x2,y2) touches the rectangle (Liang-Barsky). */
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [-dx, x1 - r.x],
    [dx, r.x + r.w - x1],
    [-dy, y1 - r.y],
    [dy, r.y + r.h - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

/** True when any solid rectangle blocks the line of sight between two points. */
export function lineBlocked(x1, y1, x2, y2) {
  for (const rect of SOLIDS) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return true;
  }
  return false;
}

/** Move a circle by (dx, dy), sliding along solid rectangles, and return its new centre. */
export function moveCircle(x, y, dx, dy, radius) {
  let nextX = x + dx;
  let nextY = y + dy;
  for (const r of SOLIDS) {
    const closestX = Math.max(r.x, Math.min(nextX, r.x + r.w));
    const closestY = Math.max(r.y, Math.min(y, r.y + r.h));
    if (Math.hypot(nextX - closestX, y - closestY) < radius) {
      nextX = x;
      break;
    }
  }
  for (const r of SOLIDS) {
    const closestX = Math.max(r.x, Math.min(nextX, r.x + r.w));
    const closestY = Math.max(r.y, Math.min(nextY, r.y + r.h));
    if (Math.hypot(nextX - closestX, nextY - closestY) < radius) {
      nextY = y;
      break;
    }
  }
  return { x: nextX, y: nextY };
}

/** Clamp a point inside the room (inside the outer walls). */
export function clampInRoom(x, y, margin) {
  return {
    x: Math.max(WALL + margin, Math.min(FIELD.width - WALL - margin, x)),
    y: Math.max(WALL + margin, Math.min(FIELD.height - WALL - margin, y)),
  };
}
